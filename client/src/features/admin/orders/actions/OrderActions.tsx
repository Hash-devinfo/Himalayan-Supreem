import { useEffect, useState } from 'react';
import { MessageSquareWarning, PhoneCall } from 'lucide-react';
import type { OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import { timeAgo } from '../../../../lib/format';
import { CANCELLATION_SOURCE_LABELS } from '../orderLabels';
import { AWAITING_CALL, CANCELLABLE, MAX_UNANSWERED_CALLS, countUnanswered } from '../orderStatus';
import CancelOrderDialog from './CancelOrderDialog';
import { DeclineRequestDialog, RecordRequestDialog } from './CancellationRequestDialogs';
import LogCallDialog from './LogCallDialog';

type DialogName = 'call' | 'cancel' | 'approve' | 'decline' | 'record' | null;

function nextStep(order: OrderDetail): { title: string; hint: string } {
  if (AWAITING_CALL.includes(order.status)) {
    const missed = countUnanswered(order);
    const left = MAX_UNANSWERED_CALLS - missed;
    if (missed === 0) return { title: 'Call the customer to confirm', hint: 'No calls logged yet.' };
    if (left <= 0) return { title: 'Three calls went unanswered', hint: 'You can cancel this order, or log a call if they call back.' };
    return {
      title: 'Call the customer to confirm',
      hint: `${missed} missed ${missed === 1 ? 'call' : 'calls'} · ${left} left before you can cancel for no answer.`,
    };
  }
  if (order.status === 'confirmed') return { title: 'Confirmed on the call', hint: 'Pack it next.' };
  return { title: '', hint: '' };
}

export default function OrderActions({ order }: { order: OrderDetail }) {
  const [dialog, setDialog] = useState<DialogName>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The green confirmation disappears after a few seconds
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const close = () => setDialog(null);
  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
  };

  const awaitingCall = AWAITING_CALL.includes(order.status);
  const cancellable = CANCELLABLE.includes(order.status);
  const request = order.cancellation?.requestStatus === 'requested' ? order.cancellation : undefined;
  const step = nextStep(order);

  return (
    <div className="space-y-3">
      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      {request && cancellable && (
        <div className="rounded-2xl border border-danger/30 bg-danger-soft p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
            The customer asked to cancel
          </p>
          <p className="mt-1 text-sm text-danger">
            {request.requestedVia ? `Through ${CANCELLATION_SOURCE_LABELS[request.requestedVia]}` : 'Request received'}
            {request.requestedAt ? `, ${timeAgo(request.requestedAt)}` : ''}.
            {request.reason ? ` "${request.reason}"` : ''} Call them to check, then choose.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setDialog('approve')} className="btn-danger px-4 py-2">
              Approve and cancel
            </button>
            <button type="button" onClick={() => setDialog('decline')} className="btn-secondary px-4 py-2">
              Keep the order
            </button>
          </div>
        </div>
      )}

      {cancellable && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="mr-auto min-w-0">
            <p className="text-sm font-medium">{step.title}</p>
            <p className="mt-0.5 text-xs text-muted">{step.hint}</p>
          </div>
          {awaitingCall && (
            <button type="button" onClick={() => setDialog('call')} className="btn-primary gap-2">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Log call
            </button>
          )}
          {!request && (
            <button type="button" onClick={() => setDialog('record')} className="btn-secondary">
              Customer asked to cancel
            </button>
          )}
          <button type="button" onClick={() => setDialog('cancel')} className="btn-secondary text-danger">
            Cancel order
          </button>
        </div>
      )}

      <LogCallDialog
        open={dialog === 'call'}
        order={order}
        onClose={close}
        onDone={done}
        onCancelOrder={() => setDialog('cancel')}
      />
      <CancelOrderDialog open={dialog === 'cancel'} mode="cancel" order={order} onClose={close} onDone={done} />
      <CancelOrderDialog open={dialog === 'approve'} mode="approve" order={order} onClose={close} onDone={done} />
      <DeclineRequestDialog open={dialog === 'decline'} order={order} onClose={close} onDone={done} />
      <RecordRequestDialog open={dialog === 'record'} order={order} onClose={close} onDone={done} />
    </div>
  );
}