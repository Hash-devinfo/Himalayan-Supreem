import { useState, type FormEvent } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type DeliveryFailureReason, type OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import { formatRs } from '../../../../lib/format';
import { COURIER_LABELS, FAILURE_REASON_LABELS } from '../orderLabels';
import { useOrderMutation } from './useOrderMutation';

interface DialogProps {
  open: boolean;
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}
type FormProps = Omit<DialogProps, 'open'>;

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.';

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-danger">{message}</p> : null;
}

function Buttons({ onClose, pending, label }: { onClose: () => void; pending: boolean; label: string }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className="btn-secondary">
        Close
      </button>
      <button type="submit" disabled={pending} className="btn-primary gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {label}
      </button>
    </div>
  );
}

// ── Delivered ────────────────────────────────────────

function DeliverForm({ order, onClose, onDone }: FormProps) {
  const total = order.pricing.total;
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState(String(total));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useOrderMutation((body: { amountCollected?: number; note?: string }) =>
    ordersApi.deliver(order.orderNumber, body),
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    const collected = full ? total : Number(amount);
    if (!full && (!Number.isInteger(collected) || collected < 0)) errors.amountCollected = 'Enter whole rupees, like 1450';
    if (collected !== total && note.trim().length < 3) errors.note = 'Explain why a different amount was collected';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      { amountCollected: full ? undefined : collected, note: note.trim() || undefined },
      {
        onSuccess: () => onDone(`Marked as delivered. ${formatRs(collected)} collected by the courier.`),
        onError: (err) => {
          setError(errorText(err));
          if (err instanceof ApiError) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm">
        <input
          type="checkbox"
          checked={full}
          onChange={(e) => setFull(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]"
        />
        <span>
          <span className="block font-medium">The courier collected the full {formatRs(total)}</span>
          <span className="block text-xs text-muted">Untick if the customer paid a different amount.</span>
        </span>
      </label>

      {!full && (
        <>
          <label htmlFor="amount-collected" className="mt-4 block text-sm font-medium">
            Amount collected (Rs)
          </label>
          <input
            id="amount-collected"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`input-field ${fieldErrors.amountCollected ? 'border-danger' : ''}`}
          />
          <FieldError message={fieldErrors.amountCollected} />
        </>
      )}

      <label htmlFor="deliver-note" className="mt-4 block text-sm font-medium">
        Note {full && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <textarea
        id="deliver-note"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className={`input-field resize-y ${fieldErrors.note ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldErrors.note} />

      <Buttons onClose={onClose} pending={mutation.isPending} label="Mark as delivered" />
    </form>
  );
}

export function DeliverDialog({ open, ...props }: DialogProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="Delivered?" description={`${props.order.orderNumber} · cash on delivery`}>
      <DeliverForm {...props} />
    </Modal>
  );
}

// ── Delivery failed ──────────────────────────────────

const FAILURE_OPTIONS: DeliveryFailureReason[] = ['refused', 'uncollected', 'address_issue', 'other'];

function FailForm({ order, onClose, onDone }: FormProps) {
  const [reason, setReason] = useState<DeliveryFailureReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | undefined>();
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const mutation = useOrderMutation((body: { reason: DeliveryFailureReason; note?: string }) =>
    ordersApi.failDelivery(order.orderNumber, body),
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNoteError(undefined);
    if (!reason) {
      setError('Choose what the courier reported.');
      return;
    }
    if (reason === 'other' && note.trim().length < 3) {
      setNoteError('Describe what went wrong');
      return;
    }
    mutation.mutate(
      { reason, note: note.trim() || undefined },
      {
        onSuccess: (result) => setWhatsappLink(result.whatsappLink),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  if (whatsappLink) {
    return (
      <div>
        <FormAlert tone="warning">Delivery failure recorded.</FormAlert>
        <p className="text-sm text-muted">
          Message the customer first. Then choose <span className="font-medium text-ink">Try delivery again</span> or{' '}
          <span className="font-medium text-ink">Parcel returned</span> on the order.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-primary gap-2">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Message on WhatsApp
          </a>
          <button type="button" onClick={() => onDone('Delivery failure recorded.')} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <fieldset>
        <legend className="text-sm font-medium">What did the courier report?</legend>
        <div className="mt-2 grid gap-2">
          {FAILURE_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-sm transition-colors hover:border-ink has-checked:border-ink has-checked:bg-canvas has-checked:font-medium has-focus-visible:outline-2 has-focus-visible:outline-sage"
            >
              <input
                type="radio"
                name="fail-reason"
                checked={reason === option}
                onChange={() => setReason(option)}
                className="h-4 w-4 accent-[var(--color-ink)]"
              />
              {FAILURE_REASON_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>
      {reason === 'refused' && (
        <p className="mt-2 text-xs text-muted">Refusals count towards this number's risk level.</p>
      )}

      <label htmlFor="fail-note" className="mt-4 block text-sm font-medium">
        Note {reason !== 'other' && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <textarea
        id="fail-note"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setNoteError(undefined);
        }}
        className={`input-field resize-y ${noteError ? 'border-danger' : ''}`}
      />
      <FieldError message={noteError} />

      <Buttons onClose={onClose} pending={mutation.isPending} label="Record failure" />
    </form>
  );
}

export function FailDeliveryDialog({ open, ...props }: DialogProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="Delivery failed" description={props.order.orderNumber}>
      <FailForm {...props} />
    </Modal>
  );
}

// ── Try delivery again ───────────────────────────────

const cleanTracking = (value: string) => value.replace(/\s+/g, '').toUpperCase();

function ReattemptForm({ order, onClose, onDone }: FormProps) {
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const courier = order.fulfillment?.courier;
  const mutation = useOrderMutation((body: { trackingNumber?: string; note?: string }) =>
    ordersApi.ship(order.orderNumber, body),
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (tracking && !/^[A-Z0-9-]{4,40}$/.test(tracking)) {
      setError('Tracking number should be 4-40 letters, numbers or dashes');
      return;
    }
    mutation.mutate(
      { trackingNumber: tracking || undefined, note: note.trim() || undefined },
      {
        onSuccess: () => onDone(`Sent out again${courier ? ` with ${COURIER_LABELS[courier]}` : ''}.`),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        The order goes back to Shipped with {courier ? COURIER_LABELS[courier] : 'the same courier'}, and the courier collects{' '}
        {formatRs(order.pricing.total)} again.
      </p>
      <label htmlFor="reattempt-tracking" className="mt-4 block text-sm font-medium">
        New tracking number <span className="font-normal text-muted">(only if the courier gave a new one)</span>
      </label>
      <input
        id="reattempt-tracking"
        value={tracking}
        onChange={(e) => setTracking(cleanTracking(e.target.value))}
        placeholder={order.fulfillment?.trackingNumber ?? ''}
        autoComplete="off"
        spellCheck={false}
        className="input-field font-medium tracking-wide"
      />
      <label htmlFor="reattempt-note" className="mt-4 block text-sm font-medium">
        Note <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id="reattempt-note"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Customer will be home after 5 pm"
        className="input-field"
      />
      <Buttons onClose={onClose} pending={mutation.isPending} label="Send out again" />
    </form>
  );
}

export function ReattemptDialog({ open, ...props }: DialogProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="Try delivery again" description={props.order.orderNumber}>
      <ReattemptForm {...props} />
    </Modal>
  );
}