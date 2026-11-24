import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Truck } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type Courier, type OrderDetail, type ShipInput } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import Modal from '../../../../components/ui/Modal';
import Skeleton from '../../../../components/ui/Skeleton';
import { formatRs } from '../../../../lib/format';
import { COURIER_LABELS } from '../orderLabels';
import { useOrderMutation } from './useOrderMutation';

// Same rule as the server: spaces removed, capitals, 4-40 letters, numbers or dashes
const cleanTracking = (value: string) => value.replace(/\s+/g, '').toUpperCase();
const TRACKING_PATTERN = /^[A-Z0-9-]{4,40}$/;

// '' = not entered; otherwise a whole number of rupees, or NaN if invalid
function parseRupees(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}

type Field = 'courier' | 'trackingNumber' | 'courierFee' | 'codCharge';

interface FormProps {
  order: OrderDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

function ShipForm({ order, onClose, onDone }: FormProps) {
  const couriers = useQuery({
    queryKey: ['couriers'],
    queryFn: ordersApi.couriers,
    staleTime: Number.POSITIVE_INFINITY, // the list only changes when the server code changes
  });

  const [courier, setCourier] = useState<Courier | null>(null);
  const [tracking, setTracking] = useState('');
  const [courierFee, setCourierFee] = useState('');
  const [codCharge, setCodCharge] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const mutation = useOrderMutation((body: ShipInput) => ordersApi.ship(order.orderNumber, body));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const errors: Partial<Record<Field, string>> = {};
    if (!courier) errors.courier = 'Choose the courier';
    if (!tracking) errors.trackingNumber = 'Enter the tracking number from the courier receipt';
    else if (!TRACKING_PATTERN.test(tracking)) errors.trackingNumber = 'Tracking number should be 4-40 letters, numbers or dashes';
    const fee = parseRupees(courierFee);
    const cod = parseRupees(codCharge);
    if (Number.isNaN(fee)) errors.courierFee = 'Enter whole rupees, like 250';
    if (Number.isNaN(cod)) errors.codCharge = 'Enter whole rupees, like 40';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !courier) return;

    mutation.mutate(
      { courier, trackingNumber: tracking, courierFee: fee, codCharge: cod, note: note.trim() || undefined },
      {
        onSuccess: () => onDone(`Shipped with ${COURIER_LABELS[courier]}. Tracking number ${tracking}.`),
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

  const fieldClass = (field: Field) =>
    `input-field ${fieldErrors[field] ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="mb-4 text-sm text-muted">
        Book the parcel with the courier first, then enter the tracking number from their receipt. The courier should collect{' '}
        <span className="font-medium text-ink">{formatRs(order.pricing.total)}</span> in cash.
      </p>

      <fieldset>
        <legend className="text-sm font-medium">Courier</legend>
        {couriers.isPending ? (
          <Skeleton className="mt-2 h-12 w-full" />
        ) : couriers.isError ? (
          <p className="mt-2 text-xs text-danger">Could not load the courier list. Close and try again.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {couriers.data.couriers.map((option) => (
              <label
                key={option.code}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-line p-3 text-sm transition-colors hover:border-ink has-checked:border-ink has-checked:bg-canvas has-checked:font-medium has-focus-visible:outline-2 has-focus-visible:outline-sage"
              >
                <input
                  type="radio"
                  name="courier"
                  value={option.code}
                  checked={courier === option.code}
                  onChange={() => {
                    setCourier(option.code);
                    setFieldErrors((prev) => ({ ...prev, courier: undefined }));
                  }}
                  className="sr-only"
                />
                <Truck className="h-4 w-4 text-muted" aria-hidden="true" />
                {option.name}
              </label>
            ))}
          </div>
        )}
        {fieldErrors.courier && <p className="mt-1.5 text-xs text-danger">{fieldErrors.courier}</p>}
      </fieldset>

      <label htmlFor="tracking" className="mt-5 block text-sm font-medium">
        Tracking number
      </label>
      <input
        id="tracking"
        value={tracking}
        onChange={(e) => {
          setTracking(cleanTracking(e.target.value));
          setFieldErrors((prev) => ({ ...prev, trackingNumber: undefined }));
        }}
        autoComplete="off"
        spellCheck={false}
        placeholder="From the courier receipt"
        aria-invalid={!!fieldErrors.trackingNumber}
        aria-describedby={fieldErrors.trackingNumber ? 'tracking-error' : undefined}
        className={`${fieldClass('trackingNumber')} font-medium tracking-wide`}
      />
      {fieldErrors.trackingNumber && (
        <p id="tracking-error" className="mt-1.5 text-xs text-danger">
          {fieldErrors.trackingNumber}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="courier-fee" className="block text-sm font-medium">
            Courier fee <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="courier-fee"
            inputMode="numeric"
            value={courierFee}
            onChange={(e) => setCourierFee(e.target.value)}
            placeholder="Rs"
            className={fieldClass('courierFee')}
          />
          {fieldErrors.courierFee && <p className="mt-1.5 text-xs text-danger">{fieldErrors.courierFee}</p>}
        </div>
        <div>
          <label htmlFor="cod-charge" className="block text-sm font-medium">
            COD charge <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="cod-charge"
            inputMode="numeric"
            value={codCharge}
            onChange={(e) => setCodCharge(e.target.value)}
            placeholder="Rs"
            className={fieldClass('codCharge')}
          />
          {fieldErrors.codCharge && <p className="mt-1.5 text-xs text-danger">{fieldErrors.codCharge}</p>}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">Used in your profit report. You can leave them empty.</p>

      <label htmlFor="ship-note" className="mt-5 block text-sm font-medium">
        Note <span className="font-normal text-muted">(optional)</span>
      </label>
      <input id="ship-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="input-field" />

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Mark as shipped
        </button>
      </div>
    </form>
  );
}

export default function ShipOrderDialog({ open, order, onClose, onDone }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Ship this order" description={`${order.customerSnapshot.name} · ${order.orderNumber}`}>
      <ShipForm order={order} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}