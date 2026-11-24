import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Undo2 } from 'lucide-react';
import type { OrderDetail, OrderStatus } from '../../../api/orders';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import { ListSkeleton, Panel, PanelError } from '../dashboard/DashboardPanel';
import { formatDate, formatRs } from '../../../lib/format';
import { useRefundList } from './queries';
import { NewRefundDialog } from './RefundDialogs';
import { OPEN_REFUND, REFUND_REASON_LABELS, REFUND_STATUS_LABELS, REFUND_STATUS_TONES } from './refundLabels';

// Refunds only exist on orders that reached the customer
const REFUND_STATUSES: OrderStatus[] = ['delivered', 'refund_pending', 'refunded'];

export default function OrderRefundsCard({ order }: { order: OrderDetail }) {
  const relevant = REFUND_STATUSES.includes(order.status);
  const refunds = useRefundList({ order: order.orderNumber, limit: 10 }, relevant);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  if (!relevant) return null;

  const list = refunds.data?.refunds ?? [];
  const hasOpen = list.some((r) => OPEN_REFUND.includes(r.status));
  const canRecord = order.status === 'delivered' && !hasOpen && (order.payment.amountCollected ?? 0) > 0 && refunds.isSuccess;

  return (
    <Panel title="Refunds" subtitle="Only for damaged or incorrect products">
      {notice && (
        <div className="px-4 pt-3">
          <FormAlert tone="success" className="">
            {notice}
          </FormAlert>
        </div>
      )}

      {refunds.isPending ? (
        <ListSkeleton rows={1} />
      ) : refunds.isError ? (
        <PanelError error={refunds.error} onRetry={() => void refunds.refetch()} />
      ) : list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No refunds for this order.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((r) => (
            <li key={r._id}>
              <Link to={`/admin/refunds/${r._id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-canvas">
                <div className="min-w-0">
                  <p className="text-sm font-medium tabular-nums">{formatRs(r.amount)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {REFUND_REASON_LABELS[r.reason]} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <Badge tone={REFUND_STATUS_TONES[r.status]}>{REFUND_STATUS_LABELS[r.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canRecord && (
        <div className="border-t border-line px-4 py-3">
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full gap-2">
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Record a refund
          </button>
        </div>
      )}

      <NewRefundDialog
        open={open}
        order={order}
        onClose={() => setOpen(false)}
        onDone={(message) => {
          setOpen(false);
          setNotice(message);
        }}
      />
    </Panel>
  );
}