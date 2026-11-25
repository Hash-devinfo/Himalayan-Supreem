import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { deliveryAdminApi, type AdminCity, type CityUpdate, type DeliveryZone } from '../../../api/delivery';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { PROVINCES, type Province } from '../../../lib/pakistan';
import { errorText } from './deliveryText';
import { useDeliveryMutation } from './queries';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-danger">{message}</p>;
}

// "" = the default zone. Zones that are off can't take new cities, so they are left out.
export function ZoneSelect({ id, value, onChange, zones }: { id: string; value: string; onChange: (v: string) => void; zones: DeliveryZone[] }) {
  const defaultZone = zones.find((z) => z.isDefault);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
      <option value="">Default zone{defaultZone ? ` (${defaultZone.name})` : ''}</option>
      {zones
        .filter((z) => z.active && !z.isDefault)
        .map((z) => (
          <option key={z._id} value={z._id}>
            {z.name}
          </option>
        ))}
    </select>
  );
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

// ── Add a city ───────────────────────────────────────

interface AddCityProps {
  zones: DeliveryZone[];
  onClose: () => void;
  onDone: (message: string) => void;
}

function AddCityForm({ zones, onClose, onDone }: AddCityProps) {
  const [name, setName] = useState('');
  const [province, setProvince] = useState<Province | ''>('');
  const [zone, setZone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useDeliveryMutation(deliveryAdminApi.createCity);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = 'Enter the city name';
    if (!province) errors.province = 'Choose the province';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !province) return;

    mutation.mutate(
      { name: name.trim(), province, zone: zone || null },
      {
        onSuccess: (result) => onDone(`${result.city.name} added. Customers can now choose it at checkout.`),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <label htmlFor="city-name" className="block text-sm font-medium">
        City or town
      </label>
      <input
        id="city-name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        className={`input-field ${fieldErrors.name ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldErrors.name} />

      <label htmlFor="city-province" className="mt-4 block text-sm font-medium">
        Province
      </label>
      <select
        id="city-province"
        value={province}
        onChange={(e) => setProvince(e.target.value as Province | '')}
        className={`input-field ${fieldErrors.province ? 'border-danger' : ''}`}
      >
        <option value="">Choose…</option>
        {PROVINCES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <FieldError message={fieldErrors.province} />

      <label htmlFor="city-zone" className="mt-4 block text-sm font-medium">
        Delivery zone
      </label>
      <ZoneSelect id="city-zone" value={zone} onChange={setZone} zones={zones} />

      <Buttons onClose={onClose} pending={mutation.isPending} label="Add city" />
    </form>
  );
}

export function AddCityDialog({ open, ...props }: AddCityProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title="Add a city">
      <AddCityForm {...props} />
    </Modal>
  );
}

// ── Edit one city ────────────────────────────────────

interface EditCityProps {
  city: AdminCity;
  zones: DeliveryZone[];
  onClose: () => void;
  onDone: (message: string) => void;
}

function EditCityForm({ city, zones, onClose, onDone }: EditCityProps) {
  const [zone, setZone] = useState(city.zone?._id ?? '');
  const [position, setPosition] = useState(String(city.sortOrder));
  const [blocked, setBlocked] = useState(city.isBlocked);
  const [error, setError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | undefined>();
  const mutation = useDeliveryMutation((body: CityUpdate) => deliveryAdminApi.updateCity(city._id, body));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const n = Number(position);
    if (!Number.isInteger(n) || n < 0 || n > 9999) {
      setPositionError('Enter a whole number from 0 to 9999');
      return;
    }
    const body: CityUpdate = {};
    if (zone !== (city.zone?._id ?? '')) body.zone = zone || null;
    if (n !== city.sortOrder) body.sortOrder = n;
    if (blocked !== city.isBlocked) body.isBlocked = blocked;
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(body, {
      onSuccess: () => onDone(`${city.name} saved.`),
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <label htmlFor="edit-city-zone" className="block text-sm font-medium">
        Delivery zone
      </label>
      <ZoneSelect id="edit-city-zone" value={zone} onChange={setZone} zones={zones} />
      {city.zone && !zones.some((z) => z._id === city.zone?._id && z.active) && (
        <p className="mt-1.5 text-xs text-warning">Its zone "{city.zone.name}" is off, so it uses the default zone for now.</p>
      )}

      <label htmlFor="edit-city-position" className="mt-4 block text-sm font-medium">
        Position in the checkout list
      </label>
      <input
        id="edit-city-position"
        type="number"
        inputMode="numeric"
        min={0}
        max={9999}
        value={position}
        onChange={(e) => {
          setPosition(e.target.value);
          setPositionError(undefined);
        }}
        className={`input-field sm:w-40 ${positionError ? 'border-danger' : ''}`}
      />
      <p className="mt-1.5 text-xs text-muted">Lower numbers come first. Give big cities 1–10 so customers find them quickly.</p>
      <FieldError message={positionError} />

      <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm">
        <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} className="mt-0.5 accent-sage" />
        <span>
          No courier delivers here
          <span className="block text-xs text-muted">
            The city disappears from checkout. Customers who type it are asked to contact you on WhatsApp.
          </span>
        </span>
      </label>

      <Buttons onClose={onClose} pending={mutation.isPending} label="Save city" />
    </form>
  );
}

export function EditCityDialog({ open, ...props }: EditCityProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={`${props.city.name}, ${props.city.province}`}>
      <EditCityForm {...props} />
    </Modal>
  );
}