import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import { useOrderMutation } from './useOrderMutation';

interface DialogProps {
  open: boolean;
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.';
}

// ── The customer asked on WhatsApp to cancel ─────────

function RecordForm({ order, onClose, onDone }: Omit<DialogProps, 'open'>) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useOrderMutation((text: string | undefined) =>
    ordersApi.recordCancellationRequest(order.orderNumber, text),
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    mutation.mutate(reason.trim() || undefined, {
      onSuccess: () => onDone('Cancellation request saved. Call the customer, then approve it or keep the order.'),
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        Nothing is cancelled yet. The order gets a "Cancel request" badge until you approve it or keep it.
      </p>
      <label htmlFor="request-reason" className="mt-4 block text-sm font-medium">
        What did they say? <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id="request-reason"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Found it cheaper elsewhere, ordered by mistake…"
        className="input-field resize-y"
      />
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save request
        </button>
      </div>
    </form>
  );
}

export function RecordRequestDialog({ open, order, onClose, onDone }: DialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Customer asked to cancel" description={`${order.orderNumber} · received on WhatsApp`}>
      <RecordForm order={order} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}

// ── The customer wants to keep the order after all ───

function DeclineForm({ order, onClose, onDone }: Omit<DialogProps, 'open'>) {
  const [note, setNote] = useState('Customer changed their mind on the call and wants the order');
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | undefined>();
  const mutation = useOrderMutation((text: string) => ordersApi.declineCancellationRequest(order.orderNumber, text));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNoteError(undefined);
    const trimmed = note.trim();
    if (trimmed.length < 3) {
      setNoteError('Write why the request is declined');
      return;
    }
    mutation.mutate(trimmed, {
      onSuccess: () => onDone('Cancellation request declined. The order carries on as normal.'),
      onError: (err) => {
        setError(errorText(err));
        if (err instanceof ApiError) setNoteError(err.details.find((d) => d.field === 'note')?.message);
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">Use this when the customer confirmed on a call that they still want the order.</p>
      <label htmlFor="decline-note" className="mt-4 block text-sm font-medium">
        Note
      </label>
      <textarea
        id="decline-note"
        rows={3}
        maxLength={500}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setNoteError(undefined);
        }}
        aria-invalid={!!noteError}
        aria-describedby={noteError ? 'decline-note-error' : undefined}
        className={`input-field resize-y ${noteError ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
      />
      {noteError && (
        <p id="decline-note-error" className="mt-1.5 text-xs text-danger">
          {noteError}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Keep the order
        </button>
      </div>
    </form>
  );
}

export function DeclineRequestDialog({ open, order, onClose, onDone }: DialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Keep the order" description={`${order.customerSnapshot.name} · ${order.orderNumber}`}>
      <DeclineForm order={order} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}