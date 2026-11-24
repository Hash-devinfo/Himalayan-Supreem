import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { batchesApi, type BatchView, type UpdateBatchInput } from '../../../api/inventory';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { useStockMutation } from './queries';

interface FormProps {
  productId: string;
  variantId: string;
  batch: BatchView;
  onClose: () => void;
  onDone: (message: string) => void;
}

function EditForm({ productId, variantId, batch, onClose, onDone }: FormProps) {
  const [batchNumber, setBatchNumber] = useState(batch.batchNumber);
  const [expiryDate, setExpiryDate] = useState(batch.expiryDate);
  const [origin, setOrigin] = useState(batch.origin ?? '');
  const [unitCost, setUnitCost] = useState(batch.unitCost !== undefined ? String(batch.unitCost) : '');
  const [notes, setNotes] = useState(batch.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useStockMutation((body: UpdateBatchInput) => batchesApi.update(productId, variantId, batch.id, body));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const body: UpdateBatchInput = {};
    if (batchNumber !== batch.batchNumber) body.batchNumber = batchNumber;
    if (expiryDate !== batch.expiryDate) body.expiryDate = expiryDate;
    if (origin.trim() !== (batch.origin ?? '')) body.origin = origin.trim();
    if (notes.trim() !== (batch.notes ?? '')) body.notes = notes.trim();
    if (unitCost !== '' && Number(unitCost) !== batch.unitCost) {
      const cost = Number(unitCost);
      if (!Number.isInteger(cost) || cost < 0) {
        setError('Cost per unit must be whole rupees.');
        return;
      }
      body.unitCost = cost;
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(body, {
      onSuccess: () => onDone(`Batch ${batchNumber} details updated.`),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="mb-4 text-sm text-muted">Quantities can't be changed here. Use Adjust stock for that.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="eb-number" className="block text-sm font-medium">Batch number</label>
          <input
            id="eb-number"
            value={batchNumber}
            maxLength={50}
            onChange={(e) => setBatchNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
            className="input-field font-medium tracking-wide"
          />
        </div>
        <div>
          <label htmlFor="eb-expiry" className="block text-sm font-medium">Expiry or best-before</label>
          <input id="eb-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="input-field" />
        </div>
        {expiryDate !== batch.expiryDate && (
          <p className="-mt-2 text-xs text-warning sm:col-span-2">The stop-selling date moves with the expiry date.</p>
        )}
        <div>
          <label htmlFor="eb-origin" className="block text-sm font-medium">Origin</label>
          <input id="eb-origin" value={origin} maxLength={200} onChange={(e) => setOrigin(e.target.value)} className="input-field" />
        </div>
        <div>
          <label htmlFor="eb-cost" className="block text-sm font-medium">Cost per unit (Rs)</label>
          <input id="eb-cost" inputMode="numeric" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="eb-notes" className="block text-sm font-medium">Notes</label>
          <textarea id="eb-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field resize-y" />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save details
        </button>
      </div>
    </form>
  );
}

export default function EditBatchDialog({ open, ...props }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={`Batch ${props.batch.batchNumber}`} description="Correct the batch details">
      <EditForm {...props} />
    </Modal>
  );
}