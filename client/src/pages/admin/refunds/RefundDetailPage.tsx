import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Ban, CircleCheck, Wallet } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { adminName } from '../../../api/refunds';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Skeleton from '../../../components/ui/Skeleton';
import { Panel, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { InfoList, InfoRow } from '../../../features/admin/orders/detail/InfoList';
import { useRefund } from '../../../features/admin/refunds/queries';
import { ApproveRefundDialog, PayRefundDialog, RejectRefundDialog } from '../../../features/admin/refunds/RefundDialogs';
import { REFUND_REASON_LABELS, REFUND_STATUS_LABELS, REFUND_STATUS_TONES } from '../../../features/admin/refunds/refundLabels';
import { formatDateTime, formatRs } from '../../../lib/format';

const by = (name: string | null) => (name ? ` · by ${name}` : '');

export default function RefundDetailPage() {
  const { refundId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useRefund(refundId);
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'pay' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const back = (
    <button
      type="button"
      onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/admin/refunds'))}
      className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </button>
  );

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {back}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {back}
        <div className="card">
          {notFound ? (
            <p className="p-6 text-center text-sm text-muted">
              This refund doesn't exist.{' '}
              <Link to="/admin/refunds" className="text-sage underline-offset-4 hover:underline">
                Go to refunds
              </Link>
            </p>
          ) : (
            <PanelError error={query.error} onRetry={() => void query.refetch()} />
          )}
        </div>
      </div>
    );
  }

  const { refund, order } = query.data;
  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
  };

  const actions =
    refund.status === 'requested'
      ? {
          title: 'Check the claim, then decide',
          hint: 'Look at the photos or the returned parcel. Approving moves the order to Refund pending.',
        }
      : refund.status === 'approved'
        ? { title: 'Approved: pay the customer', hint: `Send ${formatRs(refund.amount)}, then mark the refund as paid.` }
        : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        {back}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-medium">
              Refund for {refund.orderNumber}
              <Badge tone={REFUND_STATUS_TONES[refund.status]}>{REFUND_STATUS_LABELS[refund.status]}</Badge>
            </h1>
            <p className="mt-1 text-sm text-muted">
              {REFUND_REASON_LABELS[refund.reason]} · recorded {formatDateTime(refund.createdAt)}
              {order && (
                <>
                  {' · order is '}
                  <Link to={`/admin/orders/${refund.orderNumber}`} className="text-sage underline-offset-4 hover:underline">
                    {order.statusLabel}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Refund</p>
            <p className="text-2xl font-medium tabular-nums">{formatRs(refund.amount)}</p>
            {order && <p className="mt-0.5 text-xs text-muted">of {formatRs(order.amountCollected)} collected</p>}
          </div>
        </header>
      </div>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      {actions && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="mr-auto min-w-0">
            <p className="text-sm font-medium">{actions.title}</p>
            <p className="mt-0.5 text-xs text-muted">{actions.hint}</p>
          </div>
          {refund.status === 'requested' && (
            <button type="button" onClick={() => setDialog('approve')} className="btn-primary gap-2">
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
              Approve
            </button>
          )}
          {refund.status === 'approved' && (
            <button type="button" onClick={() => setDialog('pay')} className="btn-primary gap-2">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Mark as paid
            </button>
          )}
          <button type="button" onClick={() => setDialog('reject')} className="btn-secondary gap-2 text-danger">
            <Ban className="h-4 w-4" aria-hidden="true" />
            Reject
          </button>
        </div>
      )}

      {refund.status === 'rejected' && refund.rejectionReason && (
        <FormAlert tone="warning" className="">
          Rejected: {refund.rejectionReason}
        </FormAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Items refunded">
            <ul className="divide-y divide-line">
              {refund.items.map((item) => (
                <li key={item.variant} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {item.name} <span className="font-normal text-muted">({item.variantLabel})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {item.sku} · qty {item.qty}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">{formatRs(item.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line px-4 py-3 text-sm font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatRs(refund.amount)}</span>
            </div>
          </Panel>

          <Panel title="What the customer reported">
            <p className="whitespace-pre-line px-4 py-3 text-sm">{refund.description}</p>
          </Panel>
        </div>

        <Panel title="Record">
          <InfoList>
            <InfoRow label="Recorded">
              {formatDateTime(refund.createdAt)}
              {by(adminName(refund.requestedBy))}
            </InfoRow>
            {refund.decidedAt && (
              <InfoRow label={refund.status === 'rejected' ? 'Rejected' : 'Approved'}>
                {formatDateTime(refund.decidedAt)}
                {by(adminName(refund.decidedBy))}
              </InfoRow>
            )}
            {refund.paidAt && (
              <InfoRow label="Paid">
                {formatDateTime(refund.paidAt)}
                {by(adminName(refund.paidBy))}
              </InfoRow>
            )}
            {refund.payoutMethod && <InfoRow label="Paid by">{refund.payoutMethod}</InfoRow>}
            {refund.payoutReference && <InfoRow label="Transaction ID">{refund.payoutReference}</InfoRow>}
            {refund.status === 'paid' && (
              <InfoRow label="Stock">{refund.stockAction === 'written_off' ? 'Units written off' : 'Not written off'}</InfoRow>
            )}
          </InfoList>
        </Panel>
      </div>

      <ApproveRefundDialog open={dialog === 'approve'} refund={refund} onClose={() => setDialog(null)} onDone={done} />
      <RejectRefundDialog open={dialog === 'reject'} refund={refund} onClose={() => setDialog(null)} onDone={done} />
      <PayRefundDialog open={dialog === 'pay'} refund={refund} onClose={() => setDialog(null)} onDone={done} />
    </div>
  );
}