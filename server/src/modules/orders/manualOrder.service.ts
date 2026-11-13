import mongoose, { type Types } from 'mongoose';
import Order, { type OrderDocument, type OrderItem } from '../../models/Order.js';
import Customer from '../../models/Customer.js';
import City, { CITY_COLLATION } from '../../models/City.js';
import AppError from '../../utils/AppError.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { loadSellable } from '../cart/cart.service.js';
import { calculateDelivery, resolveCity } from '../delivery/quote.service.js';
import { reserveStock, StockShortError } from '../inventory/stock.service.js';
import { nextOrderNumber } from '../checkout/orderNumber.js';
import { getSettings } from '../settings/settings.service.js';
import { assertDailyLimit, riskForPhone } from '../customers/risk.service.js';
import { notifyOrder } from '../notifications/notification.service.js';
import { statusLabel } from './orderStatus.js';
import type { OrderStatus } from '../../constants/enums.js';
import type { ManualOrderInput } from './manualOrder.validation.js';
import { startPayment } from '../../providers/payments/index.js';



const CHANNEL_LABELS = { whatsapp: 'WhatsApp', phone: 'phone call', other: 'other' } as const;

// Manual order (requirements 4.3, Release 1): the same stock reservation, delivery charges and
// risk checks as a website order, but the items come from the admin instead of a cart.
export async function createManualOrder(input: ManualOrderInput, actor: ActorContext) {
  const adminId = new mongoose.Types.ObjectId(actor.adminId);

  // 1. Risk check first: a blocked number cannot order here either (BR-16).
  //    The admin sees why, instead of the customer's "contact us on WhatsApp" message.
  const risk = await riskForPhone(input.phone);
  if (risk.level === 'blocked') {
    throw new AppError(`This number is blocked (${risk.blockedReason ?? 'no reason recorded'}). Unblock it in Customers first.`, 403);
  }

  // 2. Current prices and weights from the database (published products, active sizes only)
  const sizes = await loadSellable(input.items.map((i) => i.variantId));
  const lines = input.items.map((item) => {
    const size = sizes.get(item.variantId);
    if (!size) throw new AppError('One of the sizes is not available (not published or not active)', 400);
    return { ...item, size };
  });
  const subtotal = lines.reduce((s, l) => s + l.size.price * l.qty, 0);
  const weight = lines.reduce((s, l) => s + l.size.shippingWeightGrams * l.qty, 0);

  const discount = input.discount?.amount ?? 0;
  if (discount > subtotal) throw new AppError(`The discount (Rs ${discount}) cannot be more than the items total (Rs ${subtotal})`, 400);

  // 3. City and delivery charge: the same rules as the website checkout
  const city = await resolveCity(input.address);
  const delivery = await calculateDelivery(city, weight, subtotal);
  if (!delivery.available) throw new AppError(delivery.message, 400);

  const settings = await getSettings();
  const orderId = new mongoose.Types.ObjectId();
  const now = new Date();
  let order: OrderDocument | undefined;

  // 4. One transaction: stock, customer, city, order number, order. Any error = nothing saved.
  try {
    await mongoose.connection.transaction(async (session) => {
      const items: OrderItem[] = [];
      for (const line of lines) {
        const variant = await reserveStock(line.variantId, line.qty, orderId, session);
        if (variant.price !== line.size.price) throw new AppError('A price has just changed. Please check the items again.', 409);
        items.push({
          product: variant.product,
          variant: variant._id,
          name: line.size.productName,
          variantLabel: line.size.label,
          sku: line.size.sku,
          unitPrice: variant.price,
          unitCost: variant.costPrice,
          qty: line.qty,
          discount: 0,
          lineTotal: variant.price * line.qty,
          batchAllocations: [],
        });
      }

      const customer = await Customer.findOneAndUpdate(
        { phone: input.phone },
        {
          $set: {
            name: input.name,
            ...(input.email ? { email: input.email } : {}),
            'stats.lastOrderAt': now,
            // Talking to the customer while taking the order verifies the number, like a confirmation call
            ...(input.confirmedWithCustomer ? { phoneVerified: true, verifiedVia: 'confirmation_call' } : {}),
          },
          $inc: { 'stats.orderCount': 1 },
        },
        { upsert: true, returnDocument: 'after', session }
      );
      if (!customer) throw new Error('Customer could not be saved');

      // Same daily limit as the website, counted inside the transaction (BR-16)
      await assertDailyLimit(input.phone, session);

      let cityRef = city.id ?? undefined;
      if (!city.listed) {
        const saved = await City.findOneAndUpdate(
          { name: city.name, province: city.province },
          { $setOnInsert: { name: city.name, province: city.province, source: 'customer', isBlocked: false, sortOrder: 100 } },
          { upsert: true, returnDocument: 'after', collation: CITY_COLLATION, session }
        );
        cityRef = saved?.id;
      }

      const orderNumber = await nextOrderNumber(settings.orderPrefix, session);
      const itemsTotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const channel = CHANNEL_LABELS[input.channel];

      const statusHistory: { status: OrderStatus; at: Date; by: Types.ObjectId; note: string }[] = [
        { status: 'new', at: now, by: adminId, note: `Manual order (${channel})` },
      ];
      if (input.confirmedWithCustomer) {
        statusHistory.push({ status: 'confirmed', at: now, by: adminId, note: `Confirmed with the customer while ordering by ${channel}` });
      }

      const [created] = await Order.create(
        [
          {
            _id: orderId,
            orderNumber,
            customer: customer._id,
            customerSnapshot: {
              name: input.name,
              phone: input.phone,
              email: input.email,
              address: {
                line1: input.address.line1,
                line2: input.address.line2,
                area: input.address.area,
                city: city.name,
                cityRef,
                cityUnlisted: !city.listed,
                province: city.province,
              },
            },
            items,
            pricing: {
              subtotal: itemsTotal,
              discountTotal: discount,
              deliveryCharge: delivery.charge,
              total: itemsTotal - discount + delivery.charge,
            },
            deliveryZone: { zone: delivery.zoneId, name: delivery.zone, estimateText: delivery.estimateText },
           payment: startPayment('cod'),
            status: input.confirmedWithCustomer ? 'confirmed' : 'new',
            statusHistory,
            // A confirmed manual order counts as a confirmation "call" (it was a conversation)
            contactAttempts: input.confirmedWithCustomer
              ? [{ attemptNo: 1, at: now, outcome: 'confirmed', note: `Confirmed while ordering by ${channel}`, by: adminId }]
              : [],
            flags: { stockShortfall: false, unlistedCity: !city.listed },
            adminNotes: input.note,
            source: { channel: input.channel, createdBy: adminId },
          },
        ],
        { session }
      );

      await recordAudit(
        {
          admin: actor.adminId,
          action: 'order.manual_create',
          entityType: 'Order',
          entityId: String(orderId),
          after: {
            orderNumber,
            channel: input.channel,
            status: created!.status,
            total: created!.pricing.total,
            ...(input.discount ? { discount: input.discount.amount, discountReason: input.discount.reason } : {}),
          },
          ip: actor.ip,
        },
        session
      );
      order = created;
    });
  } catch (error) {
    if (error instanceof StockShortError) {
      const line = lines.find((l) => l.variantId === error.variantId);
      const name = line ? `${line.size.productName} (${line.size.label})` : 'An item';
      throw new AppError(error.available > 0 ? `Only ${error.available} of ${name} left` : `${name} is sold out`, 409);
    }
    throw error;
  }
  if (!order) throw new Error('Order was not created');

  // The customer gets the matching email (if they gave one) once the order is safely saved
  notifyOrder(order._id, order.status === 'confirmed' ? 'confirmed' : 'orderPlaced');

  return {
    order,
    statusLabel: statusLabel(order.status),
    risk: await riskForPhone(order.customerSnapshot.phone),
    delivery: { charge: delivery.charge, zone: delivery.zone, estimate: delivery.estimateText, freeDelivery: delivery.freeDelivery },
  };
}