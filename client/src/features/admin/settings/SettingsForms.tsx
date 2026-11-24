import { useState } from 'react';
import { ApiError } from '../../../api/client';
import type { SettingsUpdate, StoreSettings } from '../../../api/settings';
import { formatRs } from '../../../lib/format';
import { displayPkMobile, looksLikePkMobile } from '../../../lib/phone';
import { useUpdateSettings } from './queries';
import { FieldError, NumberField, SettingsSection } from './SettingsSection';

export interface SectionProps {
  settings: StoreSettings;
  savedNotice?: string | null;
  onSaved: (message: string) => void;
}

// Shared save logic for one section
function useSectionSave(onSaved: (message: string) => void) {
  const mutation = useUpdateSettings();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function save(body: SettingsUpdate, message: string) {
    setError(null);
    mutation.mutate(body, {
      onSuccess: () => onSaved(message),
      onError: (err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
        } else {
          setError('Could not reach the server. Try again.');
        }
      },
    });
  }

  return { save, saving: mutation.isPending, error, setError, fieldErrors, setFieldErrors };
}

const isWholeIn = (value: string, min: number, max: number) => {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
};

// ── Store details ────────────────────────────────────

export function StoreDetailsForm({ settings, savedNotice, onSaved }: SectionProps) {
  const s = settings.store;
  const [name, setName] = useState(s.name);
  const [email, setEmail] = useState(s.email ?? '');
  const [whatsapp, setWhatsapp] = useState(displayPkMobile(s.whatsappNumber));
  const [hours, setHours] = useState(s.supportHours ?? '');
  const { save, saving, error, setError, fieldErrors, setFieldErrors } = useSectionSave(onSaved);

  const store: NonNullable<SettingsUpdate['store']> = {};
  if (name.trim() !== s.name) store.name = name.trim();
  if (email.trim().toLowerCase() !== (s.email ?? '')) store.email = email.trim().toLowerCase();
  if (whatsapp.trim() !== displayPkMobile(s.whatsappNumber)) store.whatsappNumber = whatsapp.trim();
  if (hours.trim() !== (s.supportHours ?? '')) store.supportHours = hours.trim();
  const dirty = Object.keys(store).length > 0;

  function submit() {
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors['store.name'] = 'Store name must be at least 2 characters';
    if (s.email && !email.trim()) errors['store.email'] = 'The store email can be changed, but not removed';
    else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors['store.email'] = 'Enter a valid email address';
    if (s.whatsappNumber && !whatsapp.trim()) errors['store.whatsappNumber'] = 'The WhatsApp number can be changed, but not removed';
    else if (whatsapp.trim() && !looksLikePkMobile(whatsapp)) errors['store.whatsappNumber'] = 'Enter a Pakistani mobile number, e.g. 0300 1234567';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(null);
      return;
    }
   const { email: newEmail, whatsappNumber: newWhatsapp, ...rest } = store;
    save(
      {
        store: {
          ...rest,
          ...(newEmail ? { email: newEmail } : {}),
          ...(newWhatsapp ? { whatsappNumber: newWhatsapp } : {}),
        },
      },
      'Store details saved',
    );
  }

  const fieldClass = (key: string) => `input-field ${fieldErrors[key] ? 'border-danger' : ''}`;

  return (
    <SettingsSection
      title="Store details"
      subtitle="Printed on invoices and packing slips, and used in order emails and WhatsApp messages."
      dirty={dirty}
      saving={saving}
      error={error}
      savedNotice={savedNotice}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="s-name" className="block text-sm font-medium">Store name</label>
          <input id="s-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={fieldClass('store.name')} />
          <FieldError message={fieldErrors['store.name']} />
        </div>
        <div>
          <label htmlFor="s-email" className="block text-sm font-medium">Store email</label>
          <input id="s-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@yourstore.pk" className={fieldClass('store.email')} />
          <FieldError message={fieldErrors['store.email']} />
        </div>
        <div>
          <label htmlFor="s-whatsapp" className="block text-sm font-medium">WhatsApp number</label>
          <input id="s-whatsapp" type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="0300 1234567" className={fieldClass('store.whatsappNumber')} />
          <FieldError message={fieldErrors['store.whatsappNumber']} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="s-hours" className="block text-sm font-medium">
            Support hours <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="s-hours" value={hours} maxLength={120} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Sat, 10 am – 7 pm" className={fieldClass('store.supportHours')} />
          <FieldError message={fieldErrors['store.supportHours']} />
        </div>
      </div>
    </SettingsSection>
  );
}

// ── Orders and delivery ──────────────────────────────

export function OrdersDeliveryForm({ settings, savedNotice, onSaved }: SectionProps) {
  const [prefix, setPrefix] = useState(settings.orderPrefix);
  const [freeOn, setFreeOn] = useState(settings.freeDeliveryThreshold !== undefined);
  const [freeAbove, setFreeAbove] = useState(settings.freeDeliveryThreshold !== undefined ? String(settings.freeDeliveryThreshold) : '');
  const [packaging, setPackaging] = useState(settings.defaultPackagingCost !== undefined ? String(settings.defaultPackagingCost) : '');
  const { save, saving, error, setError, fieldErrors, setFieldErrors } = useSectionSave(onSaved);

  const body: SettingsUpdate = {};
  if (prefix.trim().toUpperCase() !== settings.orderPrefix) body.orderPrefix = prefix.trim().toUpperCase();
  if (!freeOn && settings.freeDeliveryThreshold !== undefined) body.freeDeliveryThreshold = null;
  if (freeOn && freeAbove !== '' && Number(freeAbove) !== settings.freeDeliveryThreshold) body.freeDeliveryThreshold = Number(freeAbove);
  if (freeOn && freeAbove === '' && settings.freeDeliveryThreshold === undefined) body.freeDeliveryThreshold = Number.NaN; // forces the check below
  if (packaging !== '' && Number(packaging) !== settings.defaultPackagingCost) body.defaultPackagingCost = Number(packaging);
  const dirty = Object.keys(body).length > 0;

  function submit() {
    const errors: Record<string, string> = {};
    if (!/^[A-Z]{2,6}$/.test(prefix.trim().toUpperCase())) errors.orderPrefix = 'Use 2 to 6 letters, like ORD or HS';
    if (freeOn && !isWholeIn(freeAbove, 0, 10_000_000)) errors.freeDeliveryThreshold = 'Enter the order total in whole rupees';
    if (packaging !== '' && !isWholeIn(packaging, 0, 1_000_000)) errors.defaultPackagingCost = 'Enter whole rupees';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(null);
      return;
    }
    save(body, 'Order and delivery settings saved');
  }

  return (
    <SettingsSection
      title="Orders and delivery"
      subtitle="Delivery zones and city charges have their own screen under Delivery."
      dirty={dirty}
      saving={saving}
      error={error}
      savedNotice={savedNotice}
      onSubmit={submit}
    >
      <div>
        <label htmlFor="s-prefix" className="block text-sm font-medium">Order number prefix</label>
        <p className="mt-0.5 text-xs text-muted">The letters new order numbers start with. Existing orders keep their numbers.</p>
        <input
          id="s-prefix"
          value={prefix}
          maxLength={6}
          onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          className={`input-field w-32 font-medium tracking-wide ${fieldErrors.orderPrefix ? 'border-danger' : ''}`}
        />
        <FieldError message={fieldErrors.orderPrefix} />
      </div>

      <div className="rounded-xl border border-line p-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={freeOn} onChange={(e) => setFreeOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" />
          <span>
            <span className="block font-medium">Free delivery above an order total</span>
            <span className="block text-xs text-muted">The total after discounts decides it.</span>
          </span>
        </label>
        {freeOn && (
          <div className="mt-3 pl-7">
            <NumberField
              id="s-free"
              label="Free delivery from"
              value={freeAbove}
              suffix="rupees"
              error={fieldErrors.freeDeliveryThreshold}
              onChange={setFreeAbove}
            />
            {isWholeIn(freeAbove, 0, 10_000_000) && (
              <p className="mt-1.5 text-xs text-muted">Orders of {formatRs(Number(freeAbove))} or more ship free.</p>
            )}
          </div>
        )}
      </div>

      <NumberField
        id="s-packaging"
        label="Default packaging cost"
        hint="Per order, for the profit report. Used when an order has no packaging cost of its own."
        value={packaging}
        suffix="rupees"
        error={fieldErrors.defaultPackagingCost}
        onChange={setPackaging}
      />
    </SettingsSection>
  );
}

// ── Stock rules ──────────────────────────────────────

export function StockRulesForm({ settings, savedNotice, onSaved }: SectionProps) {
  const inv = settings.inventory;
  const [cutoff, setCutoff] = useState(String(inv.sellByCutoffDays));
  const [warning, setWarning] = useState(String(inv.expiryWarningDays));
  const [lowStock, setLowStock] = useState(String(inv.defaultLowStockThreshold));
  const { save, saving, error, setError, fieldErrors, setFieldErrors } = useSectionSave(onSaved);

  const inventory: NonNullable<SettingsUpdate['inventory']> = {};
  if (Number(cutoff) !== inv.sellByCutoffDays) inventory.sellByCutoffDays = Number(cutoff);
  if (Number(warning) !== inv.expiryWarningDays) inventory.expiryWarningDays = Number(warning);
  if (Number(lowStock) !== inv.defaultLowStockThreshold) inventory.defaultLowStockThreshold = Number(lowStock);
  const dirty = Object.keys(inventory).length > 0;
  const cutoffChanging = inventory.sellByCutoffDays !== undefined;

  function submit() {
    const errors: Record<string, string> = {};
    if (!isWholeIn(cutoff, 0, 90)) errors['inventory.sellByCutoffDays'] = 'Enter 0 to 90 days';
    if (!isWholeIn(warning, 1, 365)) errors['inventory.expiryWarningDays'] = 'Enter 1 to 365 days';
    else if (isWholeIn(cutoff, 0, 90) && Number(warning) <= Number(cutoff))
      errors['inventory.expiryWarningDays'] = 'The warning must come before stock stops selling, so make it more days';
    if (!isWholeIn(lowStock, 0, 100_000)) errors['inventory.defaultLowStockThreshold'] = 'Enter a whole number';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(null);
      return;
    }
    save(
      { inventory },
      cutoffChanging ? 'Stock rules saved. Stock is being recalculated for every size.' : 'Stock rules saved',
    );
  }

  return (
    <SettingsSection
      title="Stock rules"
      subtitle="They apply straight away to every product."
      dirty={dirty}
      saving={saving}
      error={error}
      savedNotice={savedNotice}
      onSubmit={submit}
    >
      <NumberField
        id="s-cutoff"
        label="Stop selling before expiry"
        hint="A batch leaves the store this many days before its expiry date, so customers never receive nearly-expired products."
        value={cutoff}
        suffix="days"
        error={fieldErrors['inventory.sellByCutoffDays']}
        onChange={setCutoff}
      />
      {cutoffChanging && (
        <p className="-mt-2 text-xs text-warning">
          Saving recalculates every size's stock: batches may come back on sale or stop selling.
        </p>
      )}
      <NumberField
        id="s-warning"
        label="Warn about expiry"
        hint="Batches expiring within this many days show on the dashboard and in Inventory."
        value={warning}
        suffix="days"
        error={fieldErrors['inventory.expiryWarningDays']}
        onChange={setWarning}
      />
      <NumberField
        id="s-low"
        label="Default low-stock level"
        hint="For sizes without their own alert level. Alert when this many or fewer are left."
        value={lowStock}
        suffix="units"
        error={fieldErrors['inventory.defaultLowStockThreshold']}
        onChange={setLowStock}
      />
    </SettingsSection>
  );
}

// ── Fake-order protection ────────────────────────────

export function RiskRulesForm({ settings, savedNotice, onSaved }: SectionProps) {
  const r = settings.risk;
  const [refusals, setRefusals] = useState(String(r.refusalThreshold));
  const [daily, setDaily] = useState(String(r.dailyOrderLimit));
  const { save, saving, error, setError, fieldErrors, setFieldErrors } = useSectionSave(onSaved);

  const risk: NonNullable<SettingsUpdate['risk']> = {};
  if (Number(refusals) !== r.refusalThreshold) risk.refusalThreshold = Number(refusals);
  if (Number(daily) !== r.dailyOrderLimit) risk.dailyOrderLimit = Number(daily);
  const dirty = Object.keys(risk).length > 0;

  function submit() {
    const errors: Record<string, string> = {};
    if (!isWholeIn(refusals, 1, 100)) errors['risk.refusalThreshold'] = 'Enter 1 to 100';
    if (!isWholeIn(daily, 1, 100)) errors['risk.dailyOrderLimit'] = 'Enter 1 to 100';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(null);
      return;
    }
    save({ risk }, 'Protection rules saved');
  }

  return (
    <SettingsSection
      title="Fake-order protection"
      subtitle="Helps you spot numbers that refuse parcels, and stops order floods."
      dirty={dirty}
      saving={saving}
      error={error}
      savedNotice={savedNotice}
      onSubmit={submit}
    >
      <NumberField
        id="s-refusals"
        label="High risk after"
        hint="A phone number gets the High risk badge once it has refused or not collected this many parcels."
        value={refusals}
        suffix="refused parcels"
        error={fieldErrors['risk.refusalThreshold']}
        onChange={setRefusals}
      />
      <NumberField
        id="s-daily"
        label="Most orders per phone per day"
        hint="More orders than this from one number on the same day are refused."
        value={daily}
        suffix="orders"
        error={fieldErrors['risk.dailyOrderLimit']}
        onChange={setDaily}
      />
    </SettingsSection>
  );
}