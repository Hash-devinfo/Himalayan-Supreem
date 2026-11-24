import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import type { OrderDetail } from '../../../api/orders';
import { refundsApi, type PayRefundInput, type Refund, type RefundReason } from '../../../api/refunds';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { formatRs, pktDateString } from '../../../lib/format';
import { useRefundMutation } from './queries';
import { REFUND_REASON_LABELS, looksLikeAccountNumber } from './refundLabels';

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-danger">{message}</p>;
}

function DialogButtons({ onClose, pending, label, danger = false }: { onClose: () => void; pending: boolean; label: string; danger?: boolean }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className="btn-secondary">
        Close
      </button>
      <button type="submit" disabled={pending} className={`${danger ? 'btn-danger' : 'btn-primary'} gap-2`}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {label}
      </button>
    </div>
  );
}

// ── Record a refund (from the order screen) ──────────

interface Line {
  selected: boolean;
  qty: string;
  amount: string; // empty = what the customer paid
}

type OrderItem = OrderDetail['items'][number];

// What the customer paid for `qty` of this line, after any discount (same sum as the server)
const paidFor = (item: OrderItem, qty: number) => Math.round((item.lineTotal * qty) / item.qty);

interface NewRefundProps {
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

function NewRefundForm({ order, onClose, onDone }: NewRefundProps) {
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(order.items.map((item) => [item.variant, { selected: order.items.length === 1, qty: String(item.qty), amount: '' }])),
  );
  const [reason, setReason] = useState<RefundReason | ''>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useRefundMutation(refundsApi.create);
  const collected = order.payment.amountCollected ?? 0;

  function update(variantId: string, change: Partial<Line>) {
    setLines((prev) => ({ ...prev, [variantId]: { ...prev[variantId], ...change } }));
    setFieldErrors((prev) => ({ ...prev, [variantId]: '', items: '' }));
  }

  // Works out each chosen line; a line with a problem gets an error message instead
  const chosen = order.items
    .filter((item) => lines[item.variant]?.selected)
    .map((item) => {
      const line = lines[item.variant];
      const qty = Number(line.qty);
      const qtyOk = Number.isInteger(qty) && qty >= 1 && qty <= item.qty;
      const paid = qtyOk ? paidFor(item, qty) : 0;
      const typed = line.amount.trim() === '' ? undefined : Number(line.amount);
      let problem: string | undefined;
      if (!qtyOk) problem = `Enter a quantity from 1 to ${item.qty}`;
      else if (typed !== undefined && (!Number.isInteger(typed) || typed < 0)) problem = 'Enter the amount in whole rupees';
      else if (typed !== undefined && typed > paid) problem = `Can't be more than ${formatRs(paid)}, what the customer paid`;
      return { item, qty, paid, typed, amount: typed ?? paid, problem };
    });
  const total = chosen.reduce((sum, line) => sum + (line.problem ? 0 : line.amount), 0);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    if (!reason) errors.reason = 'Choose what was wrong';
    if (description.trim().length < 5) errors.description = 'Describe what the customer reported';
    if (chosen.length === 0) errors.items = 'Choose at least one item to refund';
    for (const line of chosen) if (line.problem) errors[line.item.variant] = line.problem;
    if (!errors.items && total <= 0 && chosen.every((l) => !l.problem)) errors.items = 'The refund must be more than Rs 0';
    if (total > collected) errors.items = `The refund can't be more than the ${formatRs(collected)} collected`;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !reason) return;

    mutation.mutate(
      {
        order: order.orderNumber,
        reason,
        description: description.trim(),
        items: chosen.map((line) => ({ variantId: line.item.variant, qty: line.qty, amount: line.typed })),
      },
      {
        onSuccess: (result) => onDone(`Refund of ${formatRs(result.refund.amount)} recorded. Approve it when you've checked the photos or parcel.`),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        Refunds are only for damaged or incorrect products. The order stays Delivered until you approve the refund.
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">What was wrong?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(REFUND_REASON_LABELS) as RefundReason[]).map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                reason === value ? 'border-ink bg-canvas' : 'border-line hover:border-ink'
              }`}
            >
              <input
                type="radio"
                name="refund-reason"
                value={value}
                checked={reason === value}
                onChange={() => {
                  setReason(value);
                  setFieldErrors((prev) => ({ ...prev, reason: '' }));
                }}
                className="accent-sage"
              />
              {REFUND_REASON_LABELS[value]}
            </label>
          ))}
        </div>
        <FieldError message={fieldErrors.reason} />
      </fieldset>

      <label htmlFor="refund-description" className="mt-4 block text-sm font-medium">
        What the customer reported
      </label>
      <textarea
        id="refund-description"
        rows={3}
        maxLength={1000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Jar arrived cracked, sent photos on WhatsApp…"
        className={`input-field resize-y ${fieldErrors.description ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldErrors.description} />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Items to refund</legend>
        <div className="mt-2 space-y-2">
          {order.items.map((item) => {
            const line = lines[item.variant];
            const qty = Number(line.qty);
            const paid = Number.isInteger(qty) && qty >= 1 && qty <= item.qty ? paidFor(item, qty) : null;
            return (
              <div key={item.variant} className={`rounded-xl border p-3 ${line.selected ? 'border-ink' : 'border-line'}`}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={line.selected}
                    onChange={(e) => update(item.variant, { selected: e.target.checked })}
                    className="mt-0.5 accent-sage"
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{item.name}</span> <span className="text-muted">({item.variantLabel})</span>
                    <span className="block text-xs text-muted">
                      {item.qty} ordered · {formatRs(item.lineTotal)} paid
                    </span>
                  </span>
                </label>

                {line.selected && (
                  <div className="mt-3 grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <label htmlFor={`qty-${item.variant}`} className="block text-xs font-medium">
                        Quantity
                      </label>
                      <input
                        id={`qty-${item.variant}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={item.qty}
                        value={line.qty}
                        onChange={(e) => update(item.variant, { qty: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label htmlFor={`amount-${item.variant}`} className="block text-xs font-medium">
                        Amount (Rs)
                      </label>
                      <input
                        id={`amount-${item.variant}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={line.amount}
                        onChange={(e) => update(item.variant, { amount: e.target.value })}
                        placeholder={paid !== null ? String(paid) : ''}
                        className="input-field"
                      />
                    </div>
                    <p className="col-span-2 text-xs text-muted">Leave the amount empty to refund what the customer paid.</p>
                  </div>
                )}
                <FieldError message={fieldErrors[item.variant]} />
              </div>
            );
          })}
        </div>
        <FieldError message={fieldErrors.items} />
      </fieldset>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 text-sm">
        <span className="text-muted">Refund total · {formatRs(collected)} was collected</span>
        <span className="font-medium tabular-nums">{formatRs(total)}</span>
      </div>

      <DialogButtons onClose={onClose} pending={mutation.isPending} label="Record refund" />
    </form>
  );
}

export function NewRefundDialog({ open, ...props }: NewRefundProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={`Record a refund for ${props.order.orderNumber}`}>
      <NewRefundForm {...props} />
    </Modal>
  );
}

// ── Approve ──────────────────────────────────────────

interface RefundDialogProps {
  refund: Refund;
  onClose: () => void;
  onDone: (message: string) => void;
}

function ApproveForm({ refund, onClose, onDone }: RefundDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useRefundMutation(() => refundsApi.approve(refund._id));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    mutation.mutate(undefined, {
      onSuccess: (result) => onDone(`Refund approved. Order ${refund.orderNumber} is now ${result.orderStatus ?? 'Refund pending'}. Pay the customer next.`),
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        You agree to refund <span className="font-medium text-ink">{formatRs(refund.amount)}</span> for{' '}
        {REFUND_REASON_LABELS[refund.reason].toLowerCase()} items. Order {refund.orderNumber} moves to{' '}
        <span className="font-medium text-ink">Refund pending</span> until you mark the refund as paid.
      </p>
      <DialogButtons onClose={onClose} pending={mutation.isPending} label="Approve refund" />
    </form>
  );
}

export function ApproveRefundDialog({ open, ...props }: RefundDialogProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title="Approve this refund?">
      <ApproveForm {...props} />
    </Modal>
  );
}

// ── Reject ───────────────────────────────────────────

function RejectForm({ refund, onClose, onDone }: RefundDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useRefundMutation((text: string) => refundsApi.reject(refund._id, text));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 3) {
      setFieldError('Write why the refund is rejected');
      return;
    }
    mutation.mutate(reason.trim(), {
      onSuccess: () => onDone('Refund rejected. The order is Delivered again.'),
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      {refund.status === 'approved' && (
        <p className="mb-4 text-sm text-muted">This refund was approved. Rejecting it moves the order back to Delivered.</p>
      )}
      <label htmlFor="reject-reason" className="block text-sm font-medium">
        Reason
      </label>
      <textarea
        id="reject-reason"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setFieldError(undefined);
        }}
        placeholder="Photos show the jar sealed and undamaged…"
        className={`input-field resize-y ${fieldError ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldError} />
      <DialogButtons onClose={onClose} pending={mutation.isPending} label="Reject refund" danger />
    </form>
  );
}

export function RejectRefundDialog({ open, ...props }: RefundDialogProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title="Reject this refund?">
      <RejectForm {...props} />
    </Modal>
  );
}

// ── Mark as paid ─────────────────────────────────────

// Suggestions only; the admin can type anything
const PAYOUT_METHODS = ['Bank transfer', 'JazzCash', 'Easypaisa', 'Cash'];

function PayForm({ refund, onClose, onDone }: RefundDialogProps) {
  const today = pktDateString();
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  // Damaged units usually can't be sold again; an incorrect product might come back sealed
  const [writeOff, setWriteOff] = useState(refund.reason === 'damaged');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useRefundMutation((body: PayRefundInput) => refundsApi.pay(refund._id, body));
  const units = refund.items.reduce((sum, item) => sum + item.qty, 0);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    if (method.trim().length < 2) errors.method = 'Enter how the refund was paid';
    else if (looksLikeAccountNumber(method)) errors.method = "Don't enter card or account numbers here";
    if (looksLikeAccountNumber(reference)) errors.reference = 'Enter only the transaction ID, never a card or account number';
    if (paidOn && paidOn > today) errors.paidOn = "The payment date can't be in the future";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      {
        payoutMethod: method.trim(),
        payoutReference: reference.trim() || undefined,
        paidOn: paidOn || undefined,
        writeOff,
      },
      {
        onSuccess: (result) => onDone(`Refund paid. Order ${refund.orderNumber} is now ${result.orderStatus ?? 'Refunded'}.`),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        Send <span className="font-medium text-ink">{formatRs(refund.amount)}</span> to the customer first, then record it here.
      </p>

      <label htmlFor="pay-method" className="mt-4 block text-sm font-medium">
        Paid by
      </label>
      <input
        id="pay-method"
        list="payout-methods"
        maxLength={100}
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        placeholder="Bank transfer, JazzCash…"
        className={`input-field ${fieldErrors.method ? 'border-danger' : ''}`}
      />
      <datalist id="payout-methods">
        {PAYOUT_METHODS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <FieldError message={fieldErrors.method} />

      <label htmlFor="pay-reference" className="mt-4 block text-sm font-medium">
        Transaction ID <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id="pay-reference"
        maxLength={100}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        className={`input-field ${fieldErrors.reference ? 'border-danger' : ''}`}
      />
      <p className="mt-1.5 text-xs text-muted">Never enter the customer's card or account number.</p>
      <FieldError message={fieldErrors.reference} />

      <label htmlFor="pay-date" className="mt-4 block text-sm font-medium">
        Paid on
      </label>
      <input
        id="pay-date"
        type="date"
        max={today}
        value={paidOn}
        onChange={(e) => setPaidOn(e.target.value)}
        className={`input-field ${fieldErrors.paidOn ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldErrors.paidOn} />

      <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm">
        <input type="checkbox" checked={writeOff} onChange={(e) => setWriteOff(e.target.checked)} className="mt-0.5 accent-sage" />
        <span>
          Write off the {units} {units === 1 ? 'unit' : 'units'}
          <span className="block text-xs text-muted">
            They left stock when the order was packed. This records them as lost, so the stock report is right. Leave it off if
            the customer is sending them back sealed.
          </span>
        </span>
      </label>

      <DialogButtons onClose={onClose} pending={mutation.isPending} label="Mark as paid" />
    </form>
  );
}

export function PayRefundDialog({ open, ...props }: RefundDialogProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title="Mark the refund as paid">
      <PayForm {...props} />
    </Modal>
  );
}