import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import type { AdminProduct, AdminVariant } from '../../../api/catalog';
import { batchesApi, type ReceiveBatchInput } from '../../../api/inventory';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { pktDateString } from '../../../lib/format';
import { useStockMutation } from './queries';

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-danger">{message}</p> : null;
}

interface FormProps {
  product: AdminProduct;
  variant: AdminVariant;
  onClose: () => void;
  onDone: (message: string) => void;
}

function ReceiveForm({ product, variant, onClose, onDone }: FormProps) {
  const today = pktDateString();
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState('');
  const [origin, setOrigin] = useState(product.origin ?? '');
  const [unitCost, setUnitCost] = useState(variant.costPrice !== undefined ? String(variant.costPrice) : '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useStockMutation((body: ReceiveBatchInput) => batchesApi.receive(product._id, variant._id, body));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    const qty = Number(quantity);
    const cost = unitCost === '' ? undefined : Number(unitCost);

    if (!/^[A-Z0-9][A-Z0-9\-/.]*$/.test(batchNumber)) errors.batchNumber = 'Use letters, numbers, - / and . only';
    if (!Number.isInteger(qty) || qty < 1) errors.quantity = 'Enter how many units arrived (at least 1)';
    if (!receivedDate) errors.receivedDate = 'Choose the date it arrived';
    else if (receivedDate > today) errors.receivedDate = 'The received date cannot be in the future';
    if (!expiryDate) errors.expiryDate = 'Enter the expiry or best-before date from the pack';
    else if (expiryDate <= receivedDate) errors.expiryDate = 'Expiry must be after the received date';
    if (cost !== undefined && (!Number.isInteger(cost) || cost < 0)) errors.unitCost = 'Enter whole rupees';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      {
        batchNumber,
        quantity: qty,
        receivedDate,
        expiryDate,
        origin: origin.trim() || undefined,
        unitCost: cost,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => onDone(`Batch ${batchNumber} received: ${qty} units added.`),
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(err.message);
            setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
          } else {
            setError('Could not reach the server. Try again.');
          }
        },
      },
    );
  }

  const inputClass = (field: string) => `input-field ${fieldErrors[field] ? 'border-danger' : ''}`;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="b-number" className="block text-sm font-medium">Batch or lot number</label>
          <input
            id="b-number"
            value={batchNumber}
            maxLength={50}
            onChange={(e) => {
              setBatchNumber(e.target.value.toUpperCase().replace(/\s+/g, ''));
              setFieldErrors((p) => ({ ...p, batchNumber: '' }));
            }}
            placeholder="From the pack or supplier"
            spellCheck={false}
            className={`${inputClass('batchNumber')} font-medium tracking-wide`}
          />
          <FieldError message={fieldErrors.batchNumber} />
        </div>
        <div>
          <label htmlFor="b-qty" className="block text-sm font-medium">Quantity received</label>
          <input id="b-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass('quantity')} />
          <FieldError message={fieldErrors.quantity} />
        </div>
        <div>
          <label htmlFor="b-received" className="block text-sm font-medium">Received on</label>
          <input id="b-received" type="date" value={receivedDate} max={today} onChange={(e) => setReceivedDate(e.target.value)} className={inputClass('receivedDate')} />
          <FieldError message={fieldErrors.receivedDate} />
        </div>
        <div>
          <label htmlFor="b-expiry" className="block text-sm font-medium">Expiry or best-before</label>
          <input id="b-expiry" type="date" value={expiryDate} min={receivedDate || today} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass('expiryDate')} />
          <FieldError message={fieldErrors.expiryDate} />
        </div>
        <p className="-mt-2 text-xs text-muted sm:col-span-2">
          Batches stop selling a few days before expiry (7 days unless you change it in Settings), so a batch that expires
          sooner can't be received.
        </p>
        <div>
          <label htmlFor="b-origin" className="block text-sm font-medium">
            Origin <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="b-origin" value={origin} maxLength={200} onChange={(e) => setOrigin(e.target.value)} className={inputClass('origin')} />
        </div>
        <div>
          <label htmlFor="b-cost" className="block text-sm font-medium">
            Cost per unit (Rs) <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="b-cost" inputMode="numeric" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inputClass('unitCost')} />
          <FieldError message={fieldErrors.unitCost} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="b-notes" className="block text-sm font-medium">
            Notes <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea id="b-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Supplier, invoice number…" className="input-field resize-y" />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Receive batch
        </button>
      </div>
    </form>
  );
}

export default function ReceiveBatchDialog({ open, ...props }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title="Receive a batch" description={`${props.product.name} · ${props.variant.label}`}>
      <ReceiveForm {...props} />
    </Modal>
  );
}