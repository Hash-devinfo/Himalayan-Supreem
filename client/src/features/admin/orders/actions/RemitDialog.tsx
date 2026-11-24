import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import { formatRs, pktDateString } from '../../../../lib/format';
import { COURIER_LABELS } from '../orderLabels';
import { useOrderMutation } from './useOrderMutation';

interface FormProps {
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

function RemitForm({ order, onClose, onDone }: FormProps) {
  const today = pktDateString();
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | undefined>();
  const amount = order.payment.amountCollected ?? order.pricing.total;
  const courier = order.fulfillment?.courier;

  const mutation = useOrderMutation((body: Parameters<typeof ordersApi.remit>[0]) => ordersApi.remit(body));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setReferenceError(undefined);
    if (reference.trim().length < 2) {
      setReferenceError('Enter the payment reference from the courier statement');
      return;
    }
    mutation.mutate(
      { orders: [order.orderNumber], reference: reference.trim(), remittedOn: date || undefined },
      {
        onSuccess: (result) => onDone(`Recorded: the courier paid you ${formatRs(result.total)}.`),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        {courier ? COURIER_LABELS[courier] : 'The courier'} collected{' '}
        <span className="font-medium text-ink">{formatRs(amount)}</span> for this order. Record it once that money reaches
        your account.
      </p>

      <label htmlFor="remit-reference" className="mt-4 block text-sm font-medium">
        Payment reference
      </label>
      <input
        id="remit-reference"
        value={reference}
        maxLength={100}
        onChange={(e) => {
          setReference(e.target.value);
          setReferenceError(undefined);
        }}
        placeholder="Statement or bank transfer reference"
        className={`input-field ${referenceError ? 'border-danger' : ''}`}
      />
      {referenceError && <p className="mt-1.5 text-xs text-danger">{referenceError}</p>}

      <label htmlFor="remit-date" className="mt-4 block text-sm font-medium">
        Paid on
      </label>
      <input id="remit-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="input-field" />

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Record payment
        </button>
      </div>
    </form>
  );
}

export default function RemitDialog({ open, order, onClose, onDone }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Courier paid you" description={order.orderNumber}>
      <RemitForm order={order} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}