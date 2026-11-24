import { useState, type FormEvent } from 'react';
import { Ban, CircleCheck, CircleX, Loader2, MessageCircle, PhoneMissed, PhoneOff, type LucideIcon } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type ContactOutcome, type LogCallResponse, type OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import { CONTACT_OUTCOME_LABELS } from '../orderLabels';
import { MAX_UNANSWERED_CALLS, countUnanswered } from '../orderStatus';
import { useOrderMutation } from './useOrderMutation';

interface Option {
  value: ContactOutcome;
  hint: string;
  icon: LucideIcon;
}

const REACHED: Option[] = [
  { value: 'confirmed', hint: 'They want the order', icon: CircleCheck },
  { value: 'customer_cancelled', hint: 'Cancels the order and returns the stock', icon: CircleX },
];

const MISSED: Option[] = [
  { value: 'no_answer', hint: 'Rang, nobody picked up', icon: PhoneMissed },
  { value: 'busy', hint: 'Line busy or call cut', icon: PhoneOff },
  { value: 'switched_off', hint: 'Phone off or no signal', icon: PhoneOff },
  { value: 'wrong_number', hint: 'Someone else answered', icon: Ban },
];

function OutcomeCard({
  option,
  checked,
  disabled,
  onSelect,
}: {
  option: Option;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:border-ink has-checked:border-ink has-checked:bg-canvas has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:border-line has-focus-visible:outline-2 has-focus-visible:outline-sage">
      <input
        type="radio"
        name="outcome"
        value={option.value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${checked ? 'text-ink' : 'text-muted'}`} aria-hidden="true" />
      <span>
        <span className="block text-sm font-medium">{CONTACT_OUTCOME_LABELS[option.value]}</span>
        <span className="block text-xs text-muted">{option.hint}</span>
      </span>
    </label>
  );
}

interface FormProps {
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
  onCancelOrder: () => void;
}

function LogCallForm({ order, onClose, onDone, onCancelOrder }: FormProps) {
  const unanswered = countUnanswered(order);
  const missedBlocked = unanswered >= MAX_UNANSWERED_CALLS;

  const [outcome, setOutcome] = useState<ContactOutcome | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | undefined>();
  const [missedResult, setMissedResult] = useState<LogCallResponse | null>(null);

  const mutation = useOrderMutation((vars: { outcome: ContactOutcome; note?: string }) =>
    ordersApi.logCall(order.orderNumber, vars),
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNoteError(undefined);

    if (!outcome) {
      setError('Choose what happened on the call.');
      return;
    }
    const trimmed = note.trim();
    if (outcome === 'customer_cancelled' && trimmed.length < 3) {
      setNoteError('Write why the customer cancelled');
      return;
    }

    mutation.mutate(
      { outcome, note: trimmed || undefined },
      {
        onSuccess: (result) => {
          if (outcome === 'confirmed') onDone('Order confirmed. It is ready to pack.');
          else if (outcome === 'customer_cancelled') onDone('Order cancelled. Its stock is back in inventory.');
          else setMissedResult(result);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(err.message);
            setNoteError(err.details.find((d) => d.field === 'note')?.message);
          } else {
            setError('Could not reach the server. Check your connection and try again.');
          }
        },
      },
    );
  }

  // After a missed call: offer WhatsApp, and cancelling once three calls are missed
  if (missedResult && outcome) {
    const left = MAX_UNANSWERED_CALLS - (unanswered + 1);
    return (
      <div>
        <FormAlert tone="warning">Call logged: {CONTACT_OUTCOME_LABELS[outcome]}.</FormAlert>
        <p className="text-sm text-muted">
          {left > 0
            ? `Try again later. After ${left} more missed ${left === 1 ? 'call' : 'calls'} you can cancel for no answer.`
            : 'That was the third missed call. You can cancel this order now. If the customer calls back, log that call instead.'}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          {missedResult.whatsappLink && (
            <a href={missedResult.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-primary gap-2">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Message on WhatsApp
            </a>
          )}
          {missedResult.canCancelForNoAnswer && (
            <button type="button" onClick={onCancelOrder} className="btn-danger">
              Cancel order
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary">
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
        <legend className="text-sm font-medium">Reached the customer</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {REACHED.map((option) => (
            <OutcomeCard
              key={option.value}
              option={option}
              checked={outcome === option.value}
              disabled={false}
              onSelect={() => setOutcome(option.value)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Didn't reach them</legend>
        {missedBlocked && (
          <p className="mt-1 text-xs text-warning">
            Three calls already went unanswered. Cancel the order, or log a call that reached the customer.
          </p>
        )}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {MISSED.map((option) => (
            <OutcomeCard
              key={option.value}
              option={option}
              checked={outcome === option.value}
              disabled={missedBlocked}
              onSelect={() => setOutcome(option.value)}
            />
          ))}
        </div>
      </fieldset>

      <label htmlFor="call-note" className="mt-5 block text-sm font-medium">
        Note{' '}
        {outcome !== 'customer_cancelled' && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <textarea
        id="call-note"
        rows={3}
        maxLength={500}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setNoteError(undefined);
        }}
        placeholder={outcome === 'customer_cancelled' ? 'Why did they cancel?' : 'Anything worth remembering about this call'}
        aria-invalid={!!noteError}
        aria-describedby={noteError ? 'call-note-error' : undefined}
        className={`input-field resize-y ${noteError ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
      />
      {noteError && (
        <p id="call-note-error" className="mt-1.5 text-xs text-danger">
          {noteError}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Save call'
          )}
        </button>
      </div>
    </form>
  );
}

interface LogCallDialogProps extends FormProps {
  open: boolean;
}

export default function LogCallDialog({ open, order, onClose, onDone, onCancelOrder }: LogCallDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log call ${order.contactAttempts.length + 1}`}
      description={`${order.customerSnapshot.name} · ${order.orderNumber}`}
    >
      <LogCallForm order={order} onClose={onClose} onDone={onDone} onCancelOrder={onCancelOrder} />
    </Modal>
  );
}