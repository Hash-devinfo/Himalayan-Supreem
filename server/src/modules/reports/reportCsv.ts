import { buildCsv, type CsvSection } from '../../utils/csv.js';
import { PKT_TIME_ZONE } from '../../utils/dates.js';
import type { salesReport } from './sales.service.js';
import type { profitReport } from './profit.service.js';
import type { inventoryReport } from './stockReport.service.js';
import type { fulfillmentReport } from './fulfillmentReport.service.js';
import type { cancellationsReport } from './cancellationsReport.service.js';

// Turns each report (the same data the JSON shows) into a CSV file

type SalesReport = Awaited<ReturnType<typeof salesReport>>;
type ProfitReport = Awaited<ReturnType<typeof profitReport>>;
type InventoryReport = Awaited<ReturnType<typeof inventoryReport>>;
type FulfillmentReport = Awaited<ReturnType<typeof fulfillmentReport>>;
type CancellationsReport = Awaited<ReturnType<typeof cancellationsReport>>;

// "deliveredOrders" -> "Delivered orders", "codHeldAmount" -> "COD held amount"
function labelFor(key: string): string {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/\bcod\b/gi, 'COD');
}

function summarySection(summary: Record<string, unknown>): CsvSection {
  return { title: 'Summary', header: ['Measure', 'Value'], rows: Object.entries(summary).map(([k, v]) => [labelFor(k), v]) };
}

function definitionsSection(definitions: Record<string, string>): CsvSection {
  return { title: 'Definitions', header: ['Term', 'Meaning'], rows: Object.entries(definitions).map(([k, v]) => [labelFor(k), v]) };
}

function meta(name: string, range: { from: string; to: string }, note?: string): [string, unknown][] {
  const generated = new Intl.DateTimeFormat('en-GB', { timeZone: PKT_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  const lines: [string, unknown][] = [
    ['Report', name],
    ['From', range.from],
    ['To', range.to],
    ['Generated (Pakistan time)', generated],
    ['Amounts', 'Pakistani rupees (PKR)'],
  ];
  if (note) lines.push(['Note', note]);
  return lines;
}

const fileName = (name: string, range: { from: string; to: string }) => `${name}-${range.from}-to-${range.to}.csv`;
const field = (row: unknown, key: string) => (row as Record<string, unknown>)[key];

// ── Sales ─────────────────────────────────────────────

export function salesCsv(r: SalesReport) {
  const perItem = ['product', 'variant', 'category'].includes(r.groupBy);
  const breakdown: CsvSection = perItem
    ? {
        title: `Sales by ${r.groupBy === 'variant' ? 'size' : r.groupBy}`,
        header: [r.groupBy === 'variant' ? 'Product (size)' : 'Name', ...(r.groupBy === 'variant' ? ['SKU'] : []), 'Units', 'Orders', 'Gross', 'Discounts', 'Sales'],
        rows: r.rows.map((row) => [
          field(row, 'label'),
          ...(r.groupBy === 'variant' ? [field(row, 'sku')] : []),
          field(row, 'qty'),
          field(row, 'orders'),
          field(row, 'gross'),
          field(row, 'discounts'),
          field(row, 'sales'),
        ]),
      }
    : {
        title: `Sales by ${r.groupBy}`,
        header: [r.groupBy === 'day' ? 'Date' : 'Courier', 'Orders', 'Sales (after discounts)', 'Delivery charges'],
        rows: r.rows.map((row) => [field(row, 'label'), field(row, 'orders'), field(row, 'sales'), field(row, 'deliveryCharges')]),
      };

  return {
    filename: fileName(`sales-by-${r.groupBy}`, r.range),
    csv: buildCsv(meta('Sales', r.range), [
      summarySection(r.summary),
      { title: 'Orders placed in the period', header: ['Measure', 'Value'], rows: Object.entries(r.placed).map(([k, v]) => [labelFor(k), v]) },
      breakdown,
      definitionsSection(r.definitions),
    ]),
  };
}

// ── Profit ────────────────────────────────────────────

export function profitCsv(r: ProfitReport) {
  const m = r.missingCosts;
  return {
    filename: fileName('profit', r.range),
    csv: buildCsv(meta('Profit', r.range, m.complete ? undefined : 'Some costs are missing: profit is shown HIGHER than it really is'), [
      summarySection(r.summary),
      {
        title: 'Product profit by size',
        header: ['Product (size)', 'SKU', 'Units', 'Sales', 'Product cost', 'Gross profit', 'Margin %'],
        rows: r.bySize.map((s) => [s.label, s.sku, s.qty, s.sales, s.cost, s.grossProfit, s.marginPercent]),
      },
      {
        title: 'Missing costs',
        header: ['What is missing', 'Where'],
        rows: [
          ...m.sizesWithoutCost.map((s) => ['Cost price', s]),
          ...m.ordersWithoutCourierFee.map((o) => ['Courier fee', o]),
          ...m.ordersWithoutPackagingCost.map((o) => ['Packaging cost', o]),
        ],
      },
      definitionsSection(r.definitions),
    ]),
  };
}

// ── Inventory ─────────────────────────────────────────

export function inventoryCsv(r: InventoryReport) {
  const batchRows = (list: InventoryReport['expiringSoon']) =>
    list.map((b) => [b.product, b.label, b.sku, b.batchNumber, b.quantityRemaining, b.expiryDate, b.stopsSellingOn, b.daysToExpiry]);
  const batchHeader = ['Product', 'Size', 'SKU', 'Batch', 'Quantity', 'Expiry date', 'Stops selling on', 'Days to expiry'];

  return {
    filename: fileName('inventory', r.range),
    csv: buildCsv(meta('Inventory and expiry', r.range, 'Stock levels are as of the time generated; From/To apply to stock movements only'), [
      summarySection(r.summary),
      {
        title: 'Stock by size',
        header: ['Product', 'Size', 'SKU', 'On hand', 'Sellable', 'Reserved', 'Available', 'Low-stock threshold', 'Low stock', 'Stock value', 'Cost missing'],
        rows: r.stock.map((s) => [s.product, s.label, s.sku, s.onHand, s.sellable, s.reserved, s.available, s.threshold, s.low ? 'Yes' : 'No', s.stockValue, s.costMissing ? 'Yes' : 'No']),
      },
      { title: 'Expiring soon', header: batchHeader, rows: batchRows(r.expiringSoon) },
      { title: 'Stopped selling (write off)', header: batchHeader, rows: batchRows(r.stoppedSelling) },
      { title: 'Stock movements in the period', header: ['Type', 'Units', 'Entries'], rows: r.movements.map((m) => [m.label, m.units, m.entries]) },
      definitionsSection(r.definitions),
    ]),
  };
}

// ── Fulfillment and COD ───────────────────────────────

export function fulfillmentCsv(r: FulfillmentReport) {
  return {
    filename: fileName('fulfillment-cod', r.range),
    csv: buildCsv(meta('Fulfillment and COD', r.range, 'COD held is as of the time generated (all time)'), [
      summarySection(r.summary),
      { title: 'Orders placed, by status today', header: ['Status', 'Orders'], rows: r.ordersByStatus.map((s) => [s.label, s.count]) },
      {
        title: 'Couriers',
        header: ['Courier', 'Delivered', 'Failed', 'Returned', 'Success %', 'Average days to deliver'],
        rows: r.couriers.map((c) => [c.label, c.delivered, c.failed, c.returned, c.successPercent, c.avgDaysToDeliver]),
      },
      { title: 'Failed deliveries by reason', header: ['Reason', 'Orders'], rows: r.failures.map((f) => [f.label, f.orders]) },
      {
        title: 'COD held by couriers (not yet paid to you)',
        header: ['Courier', 'Orders', 'Amount', 'Oldest delivery (days ago)'],
        rows: r.codHeld.map((c) => [c.label, c.orders, c.amount, c.oldestDeliveredDaysAgo]),
      },
      { title: 'COD paid to you in the period', header: ['Courier', 'Orders', 'Amount'], rows: r.codRemitted.map((c) => [c.label, c.orders, c.amount]) },
      definitionsSection(r.definitions),
    ]),
  };
}

// ── Cancellations and refunds ─────────────────────────

export function cancellationsCsv(r: CancellationsReport) {
  return {
    filename: fileName('cancellations-refunds', r.range),
    csv: buildCsv(meta('Cancellations and refunds', r.range), [
      summarySection(r.summary),
      { title: 'Cancellations by type', header: ['Type', 'Orders', 'Value'], rows: r.cancellations.byType.map((t) => [t.label, t.orders, t.value]) },
      {
        title: 'Cancelled orders (newest first)',
        header: ['Order', 'Date', 'Type', 'Reason', 'Value'],
        rows: r.cancellations.recent.map((c) => [c.orderNumber, c.date, c.type, c.reason, c.value]),
      },
      { title: 'Refunds paid by reason', header: ['Reason', 'Refunds', 'Amount'], rows: r.refunds.paidByReason.map((x) => [x.label, x.refunds, x.amount]) },
      { title: 'Refunds paid by method', header: ['Payout method', 'Refunds', 'Amount'], rows: r.refunds.paidByMethod.map((x) => [x.method, x.refunds, x.amount]) },
      {
        title: 'Refunds paid by product',
        header: ['Product (size)', 'SKU', 'Units', 'Amount', 'Refunds'],
        rows: r.refunds.paidByProduct.map((x) => [x.label, x.sku, x.qty, x.amount, x.refunds]),
      },
      { title: 'Refund requests recorded in the period', header: ['Status now', 'Refunds', 'Amount'], rows: r.refunds.requestedInPeriod.map((x) => [x.status, x.refunds, x.amount]) },
      {
        title: 'Open refunds (oldest first)',
        header: ['Order', 'Status', 'Reason', 'Amount', 'Recorded on'],
        rows: r.refunds.open.map((x) => [x.orderNumber, x.status, x.reason, x.amount, x.recordedOn]),
      },
      definitionsSection(r.definitions),
    ]),
  };
}