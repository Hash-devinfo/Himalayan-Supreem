import type { OrderDetail } from '../../../../api/orders';
import CopyButton from '../../../../components/ui/CopyButton';
import { formatDateTime } from '../../../../lib/format';
import { Panel } from '../../dashboard/DashboardPanel';
import { COURIER_LABELS, FAILURE_REASON_LABELS } from '../orderLabels';
import { InfoList, InfoRow } from './InfoList';

export default function DeliveryCard({ order }: { order: OrderDetail }) {
  const zone = order.deliveryZone;
  const f = order.fulfillment ?? {};
  const shipped = Boolean(f.courier || f.dispatchedAt);

  return (
    <Panel title="Delivery">
      <InfoList>
        {zone && <InfoRow label="Zone">{zone.name}</InfoRow>}
        {zone?.estimateText && <InfoRow label="Estimate">{zone.estimateText}</InfoRow>}
        {f.courier && <InfoRow label="Courier">{COURIER_LABELS[f.courier]}</InfoRow>}
        {f.trackingNumber && (
          <InfoRow label="Tracking">
            <span className="inline-flex items-center gap-1">
              <span className="break-all font-medium tabular-nums">{f.trackingNumber}</span>
              <CopyButton text={f.trackingNumber} label="Copy tracking number" />
            </span>
          </InfoRow>
        )}
        {f.dispatchedAt && <InfoRow label="Dispatched">{formatDateTime(f.dispatchedAt)}</InfoRow>}
        {f.deliveredAt && <InfoRow label="Delivered">{formatDateTime(f.deliveredAt)}</InfoRow>}
        {f.failedAt && (
          <InfoRow label="Delivery failed">
            {formatDateTime(f.failedAt)}
            {f.failureReason && (
              <span className="block text-xs text-danger">
                {(() => {
                  const [code, ...rest] = f.failureReason.split(': ');
                  const label = FAILURE_REASON_LABELS[code] ?? code;
                  return rest.length ? `${label}: ${rest.join(': ')}` : label;
                })()}
              </span>
            )}
          </InfoRow>
        )}
        {f.returnedAt && (
          <InfoRow label="Returned">
            {formatDateTime(f.returnedAt)}
            {f.returnDecision && (
              <span className="block text-xs text-muted">
                {f.returnDecision === 'restock' ? 'Put back into stock' : 'Written off'}
              </span>
            )}
          </InfoRow>
        )}
      </InfoList>
      {!shipped && <p className="border-t border-line px-4 py-3 text-xs text-muted">Not shipped yet.</p>}
    </Panel>
  );
}