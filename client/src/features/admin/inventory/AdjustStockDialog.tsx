import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { batchesApi, type AdjustmentType, type BatchView } from '../../../api/inventory';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { formatIsoDay } from '../../../lib/format';
import { useStockMutation } from './queries';

interface Option {
  type: AdjustmentType;
  label: string;
  hint: string;
  adds: boolean;
}

const OPTIONS: Option[] = [
  { type: 'adjusted_in', label: 'Found extra', hint: 'The count was higher than the system', adds: true },
  { type: 'adjusted_out', label: 'Remove', hint: 'The count was lower, or used as a sample', adds: false },
  { type: 'damaged', label: 'Damaged', hint: 'Broken, leaking or spoiled', adds: false },
  { type: 'expired', label: 'Expired', hint: 'Past its stop-selling date', adds: false },
];

interface FormProps {
  productId: string;
  variantId: string;
  batch: BatchView;
  onClose: () => void;
  onDone: (message: string) => void;
}

function AdjustForm({ productId, variantId, batch, onClose, onDone }: FormProps) {
  const [type, setType] = useState<AdjustmentType | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useStockMutation((body: { type: AdjustmentType; quantity: number; reason: string }) =>
    batchesApi.adjust(productId, variantId, batch.id, body),
  );

  const option = OPTIONS.find((o) => o.type === type);
  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty >= 1;
  const after = option && validQty ? batch.quantityRemaining + (option.adds ? qty : -qty) : null;
  // Same rule as the server: "expired" only once the batch has stopped selling
  const expiredAllowed = !batch.isSellable;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    if (!type) errors.type = 'Choose what happened';
    if (!validQty) errors.quantity = 'Enter a whole number, at least 1';
    else if (option && !option.adds && qty > batch.quantityRemaining)
      errors.quantity = `Only ${batch.quantityRemaining} left in this batch`;
    if (reason.trim().length < 3) errors.reason = 'Give a reason (at least 3 characters)';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !type) return;

    mutation.mutate(
      { type, quantity: qty, reason: reason.trim() },
      {
        onSuccess: (result) =>
          onDone(`Batch ${batch.batchNumber}: ${option?.label.toLowerCase()} ${qty}. ${result.batch.quantityRemaining} left in the batch.`),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="mb-4 text-sm text-muted">
        {batch.quantityRemaining} in this batch now · expires {formatIsoDay(batch.expiryDate)}
      </p>

      <fieldset>
        <legend className="text-sm font-medium">What happened?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((o) => {
            const disabled = o.type === 'expired' && !expiredAllowed;
            return (
              <label
                key={o.type}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:border-ink has-checked:border-ink has-checked:bg-canvas has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:border-line has-focus-visible:outline-2 has-focus-visible:outline-sage"
              >
                <input
                  type="radio"
                  name="adjust-type"
                  checked={type === o.type}
                  disabled={disabled}
                  onChange={() => {
                    setType(o.type);
                    setFieldErrors((p) => ({ ...p, type: '' }));
                  }}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]"
                />
                <span>
                  <span className="block text-sm font-medium">
                    {o.label} <span className="text-muted">{o.adds ? '(+)' : '(−)'}</span>
                  </span>
                  <span className="block text-xs text-muted">
                    {disabled ? `Allowed from ${formatIsoDay(batch.stopsSellingOn)}. Use Remove or Damaged before then.` : o.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {fieldErrors.type && <p className="mt-1.5 text-xs text-danger">{fieldErrors.type}</p>}
      </fieldset>

      <label htmlFor="adj-qty" className="mt-4 block text-sm font-medium">
        How many units?
      </label>
      <input
        id="adj-qty"
        inputMode="numeric"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className={`input-field ${fieldErrors.quantity ? 'border-danger' : ''}`}
      />
      {fieldErrors.quantity && <p className="mt-1.5 text-xs text-danger">{fieldErrors.quantity}</p>}
      {after !== null && after >= 0 && <p className="mt-1.5 text-xs text-muted">The batch will have {after} left.</p>}

      <label htmlFor="adj-reason" className="mt-4 block text-sm font-medium">
        Reason
      </label>
      <textarea
        id="adj-reason"
        rows={2}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Monthly stock count, jar cracked in storage…"
        className={`input-field resize-y ${fieldErrors.reason ? 'border-danger' : ''}`}
      />
      {fieldErrors.reason && <p className="mt-1.5 text-xs text-danger">{fieldErrors.reason}</p>}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save adjustment
        </button>
      </div>
    </form>
  );
}

export default function AdjustStockDialog({ open, ...props }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={`Adjust batch ${props.batch.batchNumber}`}>
      <AdjustForm {...props} />
    </Modal>
  );
}