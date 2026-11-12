import mongoose, { type Types } from 'mongoose';
import Order from '../../models/Order.js';
import Batch from '../../models/Batch.js';
import Refund from '../../models/Refund.js';
import { resolveRange } from './reportRange.js';
import type { ProfitQuery } from './report.validation.js';

const DELIVERED = ['delivered', 'refund_pending', 'refunded'];

// Shown with the report, so the numbers are never ambiguous (requirements section 7: profit
// "depends on complete and accurate cost inputs")
export const PROFIT_DEFINITIONS = {
  orders: 'Orders delivered in the period (by delivery date, Pakistan time). Same orders as the sales report.',
  netSales: 'Items after discounts - refunds paid in the period. Same as the sales report.',
  deliveryIncome: 'Delivery charges the customers paid on those orders.',
  productCost: 'For each unit: the cost of the batch it was packed from; if the batch has no cost, the size cost price saved on the order.',
  packagingCost: 'Packaging cost recorded on each order (Settings default, set at packing).',
  courierFees: 'Courier fees entered when shipping.',
  codCharges: 'COD collection charges entered when shipping (this is the COD payment processing fee).',
  failedDeliveryCosts: 'Courier fees and COD charges on orders RETURNED in the period (the parcel came back, no sale).',
  profit: 'Net sales + delivery income - product cost - packaging - courier fees - COD charges - failed delivery costs.',
  missingCosts: 'Costs that were never entered count as Rs 0, so profit looks HIGHER than it really is. Fill them in.',
};

interface Line {
  variant: Types.ObjectId;
  sku: string;
  name: string;
  variantLabel: string;
  qty: number;
  lineTotal: number;
  unitCost?: number;
  batchAllocations: { batch: Types.ObjectId; qty: number }[];
}

export async function profitReport(query: ProfitQuery) {
  const range = resolveRange(query.from, query.to);

  // sanitizeFilter is on: every $-operator we build ourselves must be marked trusted
  const filter: Record<string, unknown> = {
    status: mongoose.trusted({ $in: DELIVERED }),
    'fulfillment.deliveredAt': mongoose.trusted({ $gte: range.start, $lt: range.end }),
  };
  const orders = await Order.find(filter)
    .select('orderNumber items pricing fulfillment.courierFee fulfillment.codCharge fulfillment.packagingCost')
    .lean();

  // The cost of every batch these orders were packed from (one query, not one per item)
  const batchIds = orders.flatMap((o) => o.items.flatMap((i) => i.batchAllocations.map((a) => a.batch)));
  const batches = await Batch.find({ _id: mongoose.trusted({ $in: batchIds }) }).select('unitCost').lean();
  const batchCost = new Map(batches.map((b) => [String(b._id), b.unitCost]));

  let itemsAfterDiscount = 0;
  let deliveryIncome = 0;
  let productCost = 0;
  let packagingCost = 0;
  let courierFees = 0;
  let codCharges = 0;

  const missing = { itemsWithoutCost: new Set<string>(), ordersWithoutCourierFee: [] as string[], ordersWithoutPackagingCost: [] as string[] };
  const bySize = new Map<string, { sku: string; label: string; qty: number; sales: number; cost: number }>();

  for (const order of orders) {
    itemsAfterDiscount += order.pricing.subtotal - order.pricing.discountTotal;
    deliveryIncome += order.pricing.deliveryCharge;

    for (const item of order.items as Line[]) {
      const cost = unitsCost(item, batchCost);
      if (cost.missingUnits > 0) missing.itemsWithoutCost.add(`${item.sku} (${item.name} ${item.variantLabel})`);
      productCost += cost.total;

      const row = bySize.get(String(item.variant)) ?? { sku: item.sku, label: `${item.name} (${item.variantLabel})`, qty: 0, sales: 0, cost: 0 };
      row.qty += item.qty;
      row.sales += item.lineTotal;
      row.cost += cost.total;
      bySize.set(String(item.variant), row);
    }

    const f = order.fulfillment;
    if (f.packagingCost === undefined) missing.ordersWithoutPackagingCost.push(order.orderNumber);
    if (f.courierFee === undefined) missing.ordersWithoutCourierFee.push(order.orderNumber);
    packagingCost += f.packagingCost ?? 0;
    courierFees += f.courierFee ?? 0;
    codCharges += f.codCharge ?? 0;
  }

  // Parcels that came back: the courier is still paid, but there is no sale
  const [failed] = await Order.aggregate<{ orders: number; cost: number }>([
    { $match: { status: 'returned', 'fulfillment.returnedAt': { $gte: range.start, $lt: range.end } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        cost: { $sum: { $add: [{ $ifNull: ['$fulfillment.courierFee', 0] }, { $ifNull: ['$fulfillment.codCharge', 0] }] } },
      },
    },
  ]);

  const [refundRow] = await Refund.aggregate<{ amount: number }>([
    { $match: { status: 'paid', paidAt: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);

  const refunds = refundRow?.amount ?? 0;
  const netSales = itemsAfterDiscount - refunds;
  const failedDeliveryCosts = failed?.cost ?? 0;
  const totalCosts = productCost + packagingCost + courierFees + codCharges + failedDeliveryCosts;
  const profit = netSales + deliveryIncome - totalCosts;

  return {
    range: { from: range.from, to: range.to },
    summary: {
      deliveredOrders: orders.length,
      netSales,
      refunds,
      deliveryIncome,
      productCost,
      grossProfit: itemsAfterDiscount - productCost, // items after discounts - product cost
      packagingCost,
      courierFees,
      codCharges,
      failedDeliveryCosts,
      returnedOrders: failed?.orders ?? 0,
      totalCosts,
      profit,
      marginPercent: netSales + deliveryIncome > 0 ? Math.round((profit / (netSales + deliveryIncome)) * 1000) / 10 : 0,
    },
    // Product cost per size. Packaging, courier and COD costs are per order, so they are not split here.
    bySize: [...bySize.values()]
      .map((r) => ({ ...r, grossProfit: r.sales - r.cost, marginPercent: r.sales ? Math.round(((r.sales - r.cost) / r.sales) * 1000) / 10 : 0 }))
      .sort((a, b) => b.grossProfit - a.grossProfit),
    missingCosts: {
      complete:
        missing.itemsWithoutCost.size === 0 && missing.ordersWithoutCourierFee.length === 0 && missing.ordersWithoutPackagingCost.length === 0,
      sizesWithoutCost: [...missing.itemsWithoutCost],
      ordersWithoutCourierFee: missing.ordersWithoutCourierFee.slice(0, 50),
      ordersWithoutPackagingCost: missing.ordersWithoutPackagingCost.slice(0, 50),
    },
    definitions: PROFIT_DEFINITIONS,
  };
}

// Cost of one order line: batch cost for the units packed from batches that have one,
// otherwise the size cost price copied onto the order at checkout
function unitsCost(item: Line, batchCost: Map<string, number | undefined>) {
  let total = 0;
  let missingUnits = 0;
  let counted = 0;

  for (const alloc of item.batchAllocations) {
    const cost = batchCost.get(String(alloc.batch)) ?? item.unitCost;
    if (cost === undefined) missingUnits += alloc.qty;
    else total += cost * alloc.qty;
    counted += alloc.qty;
  }

  // Units with no batch recorded (should not happen after packing, but never hide them)
  const rest = item.qty - counted;
  if (rest > 0) {
    if (item.unitCost === undefined) missingUnits += rest;
    else total += item.unitCost * rest;
  }
  return { total, missingUnits };
}