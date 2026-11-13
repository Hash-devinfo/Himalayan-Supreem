import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Refund from '../../models/Refund.js';
import type { OrderStatus, PaymentStatus } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { formatPktDate } from '../../utils/dates.js';
import { formatPkMobile } from '../../utils/phone.js';
import { getSettings } from '../settings/settings.service.js';
import { statusLabel } from './orderStatus.js';

// A confirmed sale gets an invoice (requirements 4.3). The packing slip is for packing;
// the invoice is for the customer and the books: prices, discounts, delivery, payment, refunds.
const INVOICE_STATUSES: readonly OrderStatus[] = ['confirmed', 'packing', 'shipped', 'delivered', 'delivery_failed', 'returned', 'refund_pending', 'refunded'];

const PAYMENT_METHOD_LABELS = { cod: 'Cash on delivery' } as const;
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Not paid yet (cash on delivery)',
  collected: 'Paid (cash collected on delivery)',
  refused: 'Not paid (delivery refused)',
  uncollected: 'Not paid (parcel not collected)',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
};

export async function getInvoice(idOrNumber: string) {
  const filter = mongoose.isValidObjectId(idOrNumber) ? { _id: idOrNumber } : { orderNumber: idOrNumber.trim().toUpperCase() };
  const order = await Order.findOne(filter).lean();
  if (!order) throw new AppError('Order not found', 404);
  if (!INVOICE_STATUSES.includes(order.status)) {
    throw new AppError(`An invoice is available once the order is confirmed (this order is "${statusLabel(order.status)}")`, 409);
  }

  const [settings, refunds] = await Promise.all([
    getSettings(),
    Refund.find({ order: order._id, status: 'paid' }).select('amount paidAt reason').sort({ paidAt: 1 }).lean(),
  ]);
  const c = order.customerSnapshot;
  const refunded = refunds.reduce((s, r) => s + r.amount, 0);

  return {
    invoice: {
      // The order number is the invoice number: one invoice per order
      invoiceNumber: order.orderNumber,
      invoiceDate: formatPktDate(order.createdAt),
      orderStatus: statusLabel(order.status),
      seller: {
        name: settings.store.name, // placeholder until the business sets it
        email: settings.store.email ?? null,
        whatsapp: settings.store.whatsappNumber ? formatPkMobile(settings.store.whatsappNumber) : null,
        supportHours: settings.store.supportHours ?? null,
      },
      billTo: {
        name: c.name,
        phone: formatPkMobile(c.phone),
        email: c.email ?? null,
        address: [c.address.line1, c.address.line2, c.address.area].filter(Boolean).join(', '),
        city: c.address.city,
        province: c.address.province,
      },
      items: order.items.map((i) => ({
        name: i.name,
        variantLabel: i.variantLabel,
        sku: i.sku,
        qty: i.qty,
        unitPrice: i.unitPrice,
        discount: i.discount,
        lineTotal: i.lineTotal,
        // Which batch the customer received (traceability, design 3.5)
        batches: i.batchAllocations.map((b) => ({ batchNumber: b.batchNumber, expiryDate: formatPktDate(b.expiryDate), qty: b.qty })),
      })),
      totals: {
        subtotal: order.pricing.subtotal,
        discounts: order.pricing.discountTotal,
        deliveryCharge: order.pricing.deliveryCharge,
        total: order.pricing.total,
        refunded,
        netPaid: (order.payment.amountCollected ?? 0) - refunded,
      },
      payment: {
        method: PAYMENT_METHOD_LABELS[order.payment.method],
        status: PAYMENT_STATUS_LABELS[order.payment.status],
        amountCollected: order.payment.amountCollected ?? 0,
        collectedOn: order.payment.collectedAt ? formatPktDate(order.payment.collectedAt) : null,
      },
      refunds: refunds.map((r) => ({ amount: r.amount, paidOn: r.paidAt ? formatPktDate(r.paidAt) : null, reason: r.reason })),
      currency: 'PKR',
    },
    // For the admin screen only, never printed: open business decisions that affect invoices
    notices: [
      'Tax: whether prices include sales tax, and whether invoices must show tax details, is not decided yet. No tax is shown.',
      ...(settings.store.name.includes('placeholder') ? ['The store name is still a placeholder: set it in Settings before printing invoices.'] : []),
    ],
  };
}