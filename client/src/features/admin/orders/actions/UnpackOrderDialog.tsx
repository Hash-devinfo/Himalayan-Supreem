import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import { useOrderMutation } from './useOrderMutation';

interface FormProps {
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

function UnpackForm({ order, onClose, onDone }: FormProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();
  const mutation = useOrderMutation((text: string) => ordersApi.unpack(order.orderNumber, text));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setReasonError(undefined);
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError('Write why packing is being undone');
      return;
    }
    mutation.mutate(trimmed, {
      onSuccess: () => onDone('Packing undone. The units are back in their batches and reserved for this order.'),
      onError: (err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          setReasonError(err.details.find((d) => d.field === 'reason')?.message);
        } else {
          setError('Could not reach the server. Try again.');
        }
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        The order goes back to Confirmed. Every unit returns to the batch it came from and stays reserved for this order.
      </p>
      <label htmlFor="unpack-reason" className="mt-4 block text-sm font-medium">
        Reason
      </label>
      <textarea
        id="unpack-reason"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setReasonError(undefined);
        }}
        placeholder="Packed from the wrong batch, damaged during packing…"
        aria-invalid={!!reasonError}
        aria-describedby={reasonError ? 'unpack-reason-error' : undefined}
        className={`input-field resize-y ${reasonError ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
      />
      {reasonError && (
        <p id="unpack-reason-error" className="mt-1.5 text-xs text-danger">
          {reasonError}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Undo packing
        </button>
      </div>
    </form>
  );
}

export default function UnpackOrderDialog({ open, order, onClose, onDone }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Undo packing?" description={order.orderNumber}>
      <UnpackForm order={order} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}