import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type OrderDetail, type PackingPlanResponse } from '../../../../api/orders';
import Badge from '../../../../components/ui/Badge';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import Skeleton from '../../../../components/ui/Skeleton';
import { formatDate } from '../../../../lib/format';
import { ORDERS_KEY } from '../queries';
import { useOrderMutation } from './useOrderMutation';

// variantId -> batchId -> units taken from that batch
type Picks = Record<string, Record<string, number>>;

function picksFromSuggestion(plan: PackingPlanResponse): Picks {
  return Object.fromEntries(
    plan.items.map((item) => [item.variantId, Object.fromEntries(item.suggested.map((s) => [s.batchId, s.qty]))]),
  );
}

const sumOf = (picks: Record<string, number> = {}) => Object.values(picks).reduce((sum, qty) => sum + qty, 0);

interface FormProps {
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

function PackForm({ order, onClose, onDone }: FormProps) {
  const plan = useQuery({
    queryKey: [...ORDERS_KEY, 'packing', order.orderNumber],
    queryFn: () => ordersApi.packingPlan(order.orderNumber),
    staleTime: 0, // always fresh stock numbers when the dialog opens
  });
  const [edited, setEdited] = useState<Picks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useOrderMutation((items: Parameters<typeof ordersApi.pack>[1]) => ordersApi.pack(order.orderNumber, items));

  if (plan.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (plan.isError) {
    return (
      <div>
        <FormAlert tone="danger">
          {plan.error instanceof ApiError ? plan.error.message : 'Could not load the batches. Try again.'}
        </FormAlert>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  const picks = edited ?? picksFromSuggestion(plan.data);
  const allCovered = plan.data.items.every((item) => sumOf(picks[item.variantId]) === item.qty);

  function setQty(variantId: string, batchId: string, qty: number) {
    setError(null);
    setEdited({ ...picks, [variantId]: { ...picks[variantId], [batchId]: qty } });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!allCovered) {
      setError('Each item needs exactly its ordered quantity chosen from the batches.');
      return;
    }
    const items = Object.entries(picks).map(([variantId, batches]) => ({
      variantId,
      allocations: Object.entries(batches)
        .filter(([, qty]) => qty > 0)
        .map(([batchId, qty]) => ({ batchId, qty })),
    }));
    mutation.mutate(items, {
      onSuccess: () => onDone('Order packed. The batches are recorded and the units are out of stock.'),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      {!plan.data.canPack && (
        <FormAlert tone="warning">
          Some items don't have enough sellable stock. Receive a new batch first, or talk to the customer.
        </FormAlert>
      )}

      <div className="space-y-4">
        {plan.data.items.map((item) => {
          const chosen = sumOf(picks[item.variantId]);
          const ok = chosen === item.qty;
          return (
            <fieldset key={item.variantId} className="rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-medium">
                {item.name} · {item.variantLabel}
              </legend>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted">SKU {item.sku}</span>
                <span className={`tabular-nums font-medium ${ok ? 'text-sage' : 'text-warning'}`}>
                  {chosen} of {item.qty} chosen
                </span>
              </div>

              {item.batches.length === 0 ? (
                <p className="text-xs text-danger">No sellable batches for this size.</p>
              ) : (
                <ul className="space-y-2">
                  {item.batches.map((batch, index) => {
                    const inputId = `pick-${item.variantId}-${batch.batchId}`;
                    const max = Math.min(batch.quantityRemaining, item.qty);
                    return (
                      <li key={batch.batchId} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2">
                        <label htmlFor={inputId} className="min-w-0 text-sm">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">Batch {batch.batchNumber}</span>
                            {index === 0 && <Badge tone="success">Earliest expiry</Badge>}
                          </span>
                          <span className={`block text-xs ${batch.daysToExpiry <= 60 ? 'text-warning' : 'text-muted'}`}>
                            Expires {formatDate(`${batch.expiryDate}T00:00:00Z`)} · in {batch.daysToExpiry} days ·{' '}
                            {batch.quantityRemaining} in stock
                          </span>
                        </label>
                        <input
                          id={inputId}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={max}
                          step={1}
                          value={picks[item.variantId]?.[batch.batchId] ?? 0}
                          onChange={(e) => {
                            const value = Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0)));
                            setQty(item.variantId, batch.batchId, value);
                          }}
                          className="input-field mt-0 w-20 text-right tabular-nums"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              {item.shortBy > 0 && <p className="mt-2 text-xs text-danger">{item.shortBy} short of what the order needs.</p>}
            </fieldset>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {edited && (
          <button type="button" onClick={() => setEdited(null)} className="text-sm text-sage underline-offset-4 hover:underline sm:mr-auto">
            Use the suggestion again
          </button>
        )}
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending || !plan.data.canPack} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Pack order
        </button>
      </div>
    </form>
  );
}

export default function PackOrderDialog({ open, order, onClose, onDone }: FormProps & { open: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pack this order"
      description="Batches expiring first are suggested. Change the numbers if you're packing from a different batch."
    >
      <PackForm order={order} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}