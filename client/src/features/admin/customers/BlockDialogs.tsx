import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { customersApi } from '../../../api/customers';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { looksLikePkMobile } from '../../../lib/phone';
import { useCustomerMutation } from './queries';

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');

// ── Block ────────────────────────────────────────────

interface BlockFormProps {
  phone?: string; // missing = the admin types the number
  onClose: () => void;
  onDone: (message: string, phone: string) => void;
}

function BlockForm({ phone: fixedPhone, onClose, onDone }: BlockFormProps) {
  const [phone, setPhone] = useState(fixedPhone ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useCustomerMutation((vars: { phone: string; reason: string }) => customersApi.block(vars.phone, vars.reason));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    if (!looksLikePkMobile(phone)) errors.phone = 'Enter a Pakistani mobile number, e.g. 0300 1234567';
    if (reason.trim().length < 3) errors.reason = 'Write why this number is blocked';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      { phone: phone.trim(), reason: reason.trim() },
      {
        onSuccess: (result) => onDone(`${result.phone} is blocked. It can't place new orders.`, result.phone),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        Orders from a blocked number are refused at checkout, with a message asking them to contact you on WhatsApp. Existing
        orders are not changed.
      </p>

      {!fixedPhone && (
        <>
          <label htmlFor="block-phone" className="mt-4 block text-sm font-medium">
            Phone number
          </label>
          <input
            id="block-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0300 1234567"
            className={`input-field ${fieldErrors.phone ? 'border-danger' : ''}`}
          />
          {fieldErrors.phone && <p className="mt-1.5 text-xs text-danger">{fieldErrors.phone}</p>}
        </>
      )}

      <label htmlFor="block-reason" className="mt-4 block text-sm font-medium">
        Reason
      </label>
      <textarea
        id="block-reason"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Refused 3 parcels, fake orders, abusive on calls…"
        className={`input-field resize-y ${fieldErrors.reason ? 'border-danger' : ''}`}
      />
      {fieldErrors.reason && <p className="mt-1.5 text-xs text-danger">{fieldErrors.reason}</p>}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-danger gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Block number
        </button>
      </div>
    </form>
  );
}

export function BlockDialog({ open, ...props }: BlockFormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={props.phone ? `Block ${props.phone}?` : 'Block a phone number'}>
      <BlockForm {...props} />
    </Modal>
  );
}

// ── Unblock ──────────────────────────────────────────

interface UnblockFormProps {
  phone: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

function UnblockForm({ phone, onClose, onDone }: UnblockFormProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCustomerMutation((text: string) => customersApi.unblock(phone, text || undefined));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    mutation.mutate(note.trim(), {
      onSuccess: (result) => onDone(`${result.phone} is unblocked. It can order again.`),
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">The number can place orders again. Its refusal history stays, so its risk badge may remain.</p>
      <label htmlFor="unblock-note" className="mt-4 block text-sm font-medium">
        Note <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id="unblock-note"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Spoke to the customer, the address problem is fixed"
        className="input-field"
      />
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Unblock number
        </button>
      </div>
    </form>
  );
}

export function UnblockDialog({ open, ...props }: UnblockFormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={`Unblock ${props.phone}?`}>
      <UnblockForm {...props} />
    </Modal>
  );
}