import { useEffect, useState } from 'react';
import { MessageSquareWarning, PackageCheck, PackageX, PhoneCall, RotateCcw, Truck, Wallet, CircleCheck } from 'lucide-react';
import type { OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import { formatRs, timeAgo } from '../../../../lib/format';
import { CANCELLATION_SOURCE_LABELS, COURIER_LABELS, FAILURE_REASON_LABELS } from '../orderLabels';
import { AWAITING_CALL, CANCELLABLE, COD_COLLECTED, MAX_UNANSWERED_CALLS, countUnanswered } from '../orderStatus';
import CancelOrderDialog from './CancelOrderDialog';
import { DeclineRequestDialog, RecordRequestDialog } from './CancellationRequestDialogs';
import { DeliverDialog, FailDeliveryDialog, ReattemptDialog } from './DeliveryResultDialogs';
import LogCallDialog from './LogCallDialog';
import PackOrderDialog from './PackOrderDialog';
import RemitDialog from './RemitDialog';
import ReturnOrderDialog from './ReturnOrderDialog';
import ShipOrderDialog from './ShipOrderDialog';
import UnpackOrderDialog from './UnpackOrderDialog';

type DialogName =
  | 'call' | 'cancel' | 'approve' | 'decline' | 'record'
  | 'pack' | 'unpack' | 'ship'
  | 'deliver' | 'fail' | 'reattempt' | 'return' | 'remit'
  | null;

function failureText(raw?: string): string {
  if (!raw) return 'Reason not recorded';
  const [code, ...rest] = raw.split(': '); // the server stores "reason: note"
  const label = FAILURE_REASON_LABELS[code] ?? code;
  return rest.length ? `${label}: ${rest.join(': ')}` : label;
}

function nextStep(order: OrderDetail, requestOpen: boolean, codHeld: boolean): { title: string; hint: string } | null {
  const f = order.fulfillment ?? {};
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
  switch (order.status) {
    case 'confirmed':
      return requestOpen
        ? { title: 'Confirmed, but the customer asked to cancel', hint: 'Decide the request above before packing.' }
        : { title: 'Confirmed on the call', hint: 'Pack it next. Batches expiring first are suggested.' };
    case 'packing':
      return { title: 'Packed and ready to ship', hint: 'Book it with the courier, then enter the tracking number.' };
    case 'shipped':
      return {
        title: `On the way${f.courier ? ` with ${COURIER_LABELS[f.courier]}` : ''}`,
        hint: `Tracking ${f.trackingNumber ?? '—'}. Record the result when the courier reports back.`,
      };
    case 'delivery_failed':
      return { title: 'Delivery failed', hint: `${failureText(f.failureReason)}. Try again, or take the parcel back.` };
    default:
      return codHeld
        ? {
            title: 'Delivered',
            hint: `The courier still holds ${formatRs(order.payment.amountCollected ?? order.pricing.total)} for this order.`,
          }
        : null;
  }
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

  const status = order.status;
  const awaitingCall = AWAITING_CALL.includes(status);
  const cancellable = CANCELLABLE.includes(status);
  const codHeld = COD_COLLECTED.includes(status) && order.payment.remittanceStatus === 'pending';
  const request = order.cancellation?.requestStatus === 'requested' ? order.cancellation : undefined;
  const step = nextStep(order, Boolean(request), codHeld);

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

      {step && (
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
          {status === 'confirmed' && !request && (
            <button type="button" onClick={() => setDialog('pack')} className="btn-primary gap-2">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              Pack order
            </button>
          )}
          {status === 'packing' && (
            <>
              <button type="button" onClick={() => setDialog('ship')} className="btn-primary gap-2">
                <Truck className="h-4 w-4" aria-hidden="true" />
                Ship order
              </button>
              <button type="button" onClick={() => setDialog('unpack')} className="btn-secondary">
                Undo packing
              </button>
            </>
          )}
          {status === 'shipped' && (
            <>
              <button type="button" onClick={() => setDialog('deliver')} className="btn-primary gap-2">
                <CircleCheck className="h-4 w-4" aria-hidden="true" />
                Delivered
              </button>
              <button type="button" onClick={() => setDialog('fail')} className="btn-secondary text-danger">
                Delivery failed
              </button>
            </>
          )}
          {status === 'delivery_failed' && (
            <>
              <button type="button" onClick={() => setDialog('reattempt')} className="btn-primary gap-2">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try delivery again
              </button>
              <button type="button" onClick={() => setDialog('return')} className="btn-secondary gap-2">
                <PackageX className="h-4 w-4" aria-hidden="true" />
                Parcel returned
              </button>
            </>
          )}
          {codHeld && (
            <button type="button" onClick={() => setDialog('remit')} className="btn-primary gap-2">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Courier paid you
            </button>
          )}
          {cancellable && !request && (
            <button type="button" onClick={() => setDialog('record')} className="btn-secondary">
              Customer asked to cancel
            </button>
          )}
          {cancellable && (
            <button type="button" onClick={() => setDialog('cancel')} className="btn-secondary text-danger">
              Cancel order
            </button>
          )}
        </div>
      )}

      <LogCallDialog open={dialog === 'call'} order={order} onClose={close} onDone={done} onCancelOrder={() => setDialog('cancel')} />
      <CancelOrderDialog open={dialog === 'cancel'} mode="cancel" order={order} onClose={close} onDone={done} />
      <CancelOrderDialog open={dialog === 'approve'} mode="approve" order={order} onClose={close} onDone={done} />
      <DeclineRequestDialog open={dialog === 'decline'} order={order} onClose={close} onDone={done} />
      <RecordRequestDialog open={dialog === 'record'} order={order} onClose={close} onDone={done} />
      <PackOrderDialog open={dialog === 'pack'} order={order} onClose={close} onDone={done} />
      <UnpackOrderDialog open={dialog === 'unpack'} order={order} onClose={close} onDone={done} />
      <ShipOrderDialog open={dialog === 'ship'} order={order} onClose={close} onDone={done} />
      <DeliverDialog open={dialog === 'deliver'} order={order} onClose={close} onDone={done} />
      <FailDeliveryDialog open={dialog === 'fail'} order={order} onClose={close} onDone={done} />
      <ReattemptDialog open={dialog === 'reattempt'} order={order} onClose={close} onDone={done} />
      <ReturnOrderDialog open={dialog === 'return'} order={order} onClose={close} onDone={done} />
      <RemitDialog open={dialog === 'remit'} order={order} onClose={close} onDone={done} />
    </div>
  );
}