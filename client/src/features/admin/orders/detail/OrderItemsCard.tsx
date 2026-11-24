import type { OrderDetail } from '../../../../api/orders';
import Badge from '../../../../components/ui/Badge';
import { formatDate, formatDateTime, formatRs } from '../../../../lib/format';
import { Panel } from '../../dashboard/DashboardPanel';
import { PAYMENT_STATUS_LABELS } from '../orderLabels';

export default function OrderItemsCard({ order }: { order: OrderDetail }) {
  const { items, pricing, payment, promotion } = order;
  const units = items.reduce((sum, item) => sum + item.qty, 0);

  const paymentTone =
    payment.status === 'collected' ? 'success' : payment.status === 'refused' || payment.status === 'uncollected' ? 'danger' : 'neutral';

  return (
    <Panel title="Items" subtitle={`${units} ${units === 1 ? 'unit' : 'units'} · ${items.length} ${items.length === 1 ? 'product' : 'products'}`}>
      <ul className="divide-y divide-line">
        {items.map((item, i) => (
          <li key={item._id ?? i} className="px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {item.variantLabel} · SKU {item.sku}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted">
                  {item.qty} × {formatRs(item.unitPrice)}
                  {item.discount > 0 && (
                    <span className="text-sage">
                      {' '}
                      · {formatRs(item.discount)} off{item.promotionName ? ` (${item.promotionName})` : ''}
                    </span>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums">{formatRs(item.lineTotal)}</p>
            </div>

            {item.batchAllocations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.batchAllocations.map((batch) => (
                  <li key={batch.batch} className="rounded-md bg-canvas px-2.5 py-1.5 text-xs text-muted">
                    Packed from batch <span className="font-medium text-ink">{batch.batchNumber}</span> ×{' '}
                    {batch.qty} · expires {formatDate(batch.expiryDate)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <dl className="space-y-1.5 border-t border-line px-4 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Items</dt>
          <dd className="tabular-nums">{formatRs(pricing.subtotal)}</dd>
        </div>
        {pricing.discountTotal > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Discount{promotion ? ` (code ${promotion.code})` : ''}</dt>
            <dd className="tabular-nums text-sage">−{formatRs(pricing.discountTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Delivery</dt>
          <dd className="tabular-nums">{pricing.deliveryCharge === 0 ? 'Free' : formatRs(pricing.deliveryCharge)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatRs(pricing.total)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
        <span className="text-muted">Cash on delivery</span>
        <Badge tone={paymentTone}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
        {payment.amountCollected !== undefined && payment.collectedAt && (
          <p className="w-full text-xs text-muted">
            {formatRs(payment.amountCollected)} collected on {formatDateTime(payment.collectedAt)}
          </p>
        )}
        {payment.remittanceStatus === 'remitted' && payment.remittedAt && (
          <p className="w-full text-xs text-muted">
            Paid to you by the courier on {formatDate(payment.remittedAt)}
            {payment.remittanceRef ? ` · ref ${payment.remittanceRef}` : ''}
          </p>
        )}
        {payment.remittanceStatus === 'pending' && (
          <p className="w-full text-xs text-warning">The courier hasn't paid this amount to you yet.</p>
        )}
      </div>
    </Panel>
  );
}