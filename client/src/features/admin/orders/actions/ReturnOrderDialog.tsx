import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type OrderDetail, type ReturnDecision } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import { useOrderMutation } from './useOrderMutation';

interface FormProps {
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

interface Choice {
  decision: ReturnDecision;
  reason: string;
}

function ReturnForm({ order, onClose, onDone }: FormProps) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(order.items.map((item) => [item.variant, { decision: 'restock', reason: '' }])),
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reasonErrors, setReasonErrors] = useState<Record<string, string>>({});
  const mutation = useOrderMutation((body: Parameters<typeof ordersApi.returnOrder>[1]) =>
    ordersApi.returnOrder(order.orderNumber, body),
  );

  function update(variantId: string, change: Partial<Choice>) {
    setChoices((prev) => ({ ...prev, [variantId]: { ...prev[variantId], ...change } }));
    setReasonErrors((prev) => ({ ...prev, [variantId]: '' }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    for (const [variantId, choice] of Object.entries(choices)) {
      if (choice.decision === 'write_off' && choice.reason.trim().length < 3) errors[variantId] = 'Write why it is written off';
    }
    setReasonErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const items = Object.entries(choices).map(([variantId, choice]) => ({
      variantId,
      decision: choice.decision,
      reason: choice.reason.trim() || undefined,
    }));
    const restocked = items.filter((i) => i.decision === 'restock').length;

    mutation.mutate(
      { items, note: note.trim() || undefined },
      {
        onSuccess: () =>
          onDone(
            restocked === items.length
              ? 'Parcel returned. Everything is back in stock.'
              : restocked === 0
                ? 'Parcel returned. The items were written off.'
                : 'Parcel returned. Some items are back in stock, the rest were written off.',
          ),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="mb-4 text-sm text-muted">
        Check each item. Put it back in stock only if it's sealed and undamaged; otherwise write it off.
      </p>

      <div className="space-y-3">
        {order.items.map((item) => {
          const choice = choices[item.variant];
          return (
            <fieldset key={item.variant} className="rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-medium">
                {item.name} · {item.variantLabel} × {item.qty}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['restock', 'write_off'] as const).map((decision) => (
                  <label
                    key={decision}
                    className="flex cursor-pointer items-center justify-center rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-ink has-checked:border-ink has-checked:bg-canvas has-checked:font-medium has-focus-visible:outline-2 has-focus-visible:outline-sage"
                  >
                    <input
                      type="radio"
                      name={`return-${item.variant}`}
                      checked={choice.decision === decision}
                      onChange={() => update(item.variant, { decision })}
                      className="sr-only"
                    />
                    {decision === 'restock' ? 'Put back in stock' : 'Write off'}
                  </label>
                ))}
              </div>
              {choice.decision === 'write_off' && (
                <>
                  <label htmlFor={`writeoff-${item.variant}`} className="mt-3 block text-xs font-medium">
                    Why?
                  </label>
                  <input
                    id={`writeoff-${item.variant}`}
                    value={choice.reason}
                    maxLength={500}
                    onChange={(e) => update(item.variant, { reason: e.target.value })}
                    placeholder="Seal broken, jar cracked, packet wet…"
                    className={`input-field ${reasonErrors[item.variant] ? 'border-danger' : ''}`}
                  />
                  {reasonErrors[item.variant] && (
                    <p className="mt-1.5 text-xs text-danger">{reasonErrors[item.variant]}</p>
                  )}
                </>
              )}
            </fieldset>
          );
        })}
      </div>

      <label htmlFor="return-note" className="mt-4 block text-sm font-medium">
        Note <span className="font-normal text-muted">(optional)</span>
      </label>
      <input id="return-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="input-field" />

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Record return
        </button>
      </div>
    </form>
  );
}

export default function ReturnOrderDialog({ open, order, onClose, onDone }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Parcel returned" description={order.orderNumber}>
      <ReturnForm order={order} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}