import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import { MAX_UNANSWERED_CALLS, countUnanswered } from '../orderStatus';
import { useOrderMutation } from './useOrderMutation';

const QUICK_REASONS = [
  'No answer after 3 calls',
  'Customer changed their mind',
  'Fake or prank order',
  'Duplicate order',
  'Courier does not deliver to this address',
];

type Mode = 'cancel' | 'approve';

function startingReason(order: OrderDetail, mode: Mode): string {
  if (mode === 'approve') {
    const asked = order.cancellation?.reason;
    return asked ? `Customer asked to cancel: ${asked}` : 'Customer asked to cancel';
  }
  return countUnanswered(order) >= MAX_UNANSWERED_CALLS ? 'No answer after 3 calls' : '';
}

interface FormProps {
  order: OrderDetail;
  mode: Mode;
  onClose: () => void;
  onDone: (message: string) => void;
}

function CancelForm({ order, mode, onClose, onDone }: FormProps) {
  const [reason, setReason] = useState(() => startingReason(order, mode));
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();

  const mutation = useOrderMutation((text: string) => ordersApi.cancel(order.orderNumber, text));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setReasonError(undefined);

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError('Write the reason for cancelling');
      return;
    }

    mutation.mutate(trimmed, {
      onSuccess: () => onDone('Order cancelled. Its stock is back in inventory.'),
      onError: (err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          setReasonError(err.details.find((d) => d.field === 'reason')?.message);
        } else {
          setError('Could not reach the server. Check your connection and try again.');
        }
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <FormAlert tone="warning">
        This can't be undone. The reserved stock goes back to inventory
        {order.customerSnapshot.email ? ', and the customer is emailed that the order is cancelled' : ''}.
      </FormAlert>

      <p className="text-sm font-medium">Quick reasons</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_REASONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => {
              setReason(text);
              setReasonError(undefined);
            }}
            aria-pressed={reason === text}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              reason === text ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <label htmlFor="cancel-reason" className="mt-5 block text-sm font-medium">
        Reason
      </label>
      <textarea
        id="cancel-reason"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setReasonError(undefined);
        }}
        aria-invalid={!!reasonError}
        aria-describedby={reasonError ? 'cancel-reason-error' : undefined}
        className={`input-field resize-y ${reasonError ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
      />
      {reasonError && (
        <p id="cancel-reason-error" className="mt-1.5 text-xs text-danger">
          {reasonError}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Keep order
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-danger gap-2">
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cancelling…
            </>
          ) : (
            'Cancel order'
          )}
        </button>
      </div>
    </form>
  );
}

interface CancelOrderDialogProps extends FormProps {
  open: boolean;
}

export default function CancelOrderDialog({ open, order, mode, onClose, onDone }: CancelOrderDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'approve' ? 'Approve the cancellation' : 'Cancel this order?'}
      description={`${order.customerSnapshot.name} · ${order.orderNumber}`}
    >
      <CancelForm order={order} mode={mode} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}