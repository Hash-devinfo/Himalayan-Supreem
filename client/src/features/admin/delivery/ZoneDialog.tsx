import { useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { deliveryAdminApi, type DeliveryZone, type ZoneInput } from '../../../api/delivery';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { formatRs } from '../../../lib/format';
import { errorText, formatGrams } from './deliveryText';
import { useDeliveryMutation } from './queries';

type Mode = 'flat' | 'weight';

interface RuleRow {
  key: number; // stable key while rows are added and removed
  upToGrams: string;
  charge: string;
}

const isWhole = (text: string, min: number, max: number) => {
  const n = Number(text);
  return text.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-danger">{message}</p>;
}

interface ZoneFormProps {
  zone?: DeliveryZone; // missing = new zone
  onClose: () => void;
  onDone: (message: string) => void;
}

function ZoneForm({ zone, onClose, onDone }: ZoneFormProps) {
  const [name, setName] = useState(zone?.name ?? '');
  const [estimate, setEstimate] = useState(zone?.estimateText ?? '');
  const [mode, setMode] = useState<Mode>(zone && zone.weightRules.length > 0 ? 'weight' : 'flat');
  const [charge, setCharge] = useState(zone ? String(zone.charge) : '');
  const [nextKey, setNextKey] = useState(100);
  const [rules, setRules] = useState<RuleRow[]>(() =>
    zone && zone.weightRules.length > 0
      ? zone.weightRules.map((r, i) => ({ key: i, upToGrams: String(r.upToGrams), charge: String(r.charge) }))
      : [
          { key: 0, upToGrams: '500', charge: '' },
          { key: 1, upToGrams: '1000', charge: '' },
        ],
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useDeliveryMutation((body: ZoneInput) =>
    zone ? deliveryAdminApi.updateZone(zone._id, body) : deliveryAdminApi.createZone(body),
  );

  function updateRule(key: number, change: Partial<RuleRow>) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));
    setFieldErrors((prev) => ({ ...prev, rules: '' }));
  }

  function addRule() {
    const last = rules[rules.length - 1];
    const suggested = last && isWhole(last.upToGrams, 1, 100_000) ? String(Number(last.upToGrams) + 1000) : '';
    setRules((prev) => [...prev, { key: nextKey, upToGrams: suggested, charge: '' }]);
    setNextKey((k) => k + 1);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = 'Give the zone a name, e.g. "Major cities"';
    if (estimate.trim().length < 2) errors.estimate = 'Enter the delivery time your courier gives, e.g. "2–4 working days"';

    let weightRules: ZoneInput['weightRules'] = [];
    let flatCharge = Number(charge);
    if (mode === 'flat') {
      if (!isWhole(charge, 0, 100_000)) errors.charge = 'Enter the charge in whole rupees (0 for free)';
    } else {
      const bad = rules.find((r) => !isWhole(r.upToGrams, 1, 100_000) || !isWhole(r.charge, 0, 100_000));
      if (rules.length === 0) errors.rules = 'Add at least one weight band';
      else if (bad) errors.rules = 'Fill every band with a weight in grams and a charge in whole rupees';
      else {
        weightRules = rules.map((r) => ({ upToGrams: Number(r.upToGrams), charge: Number(r.charge) }));
        const sorted = [...weightRules].sort((a, b) => a.upToGrams - b.upToGrams);
        if (sorted.some((r, i) => i > 0 && r.upToGrams === sorted[i - 1]?.upToGrams)) {
          errors.rules = 'Two bands have the same weight';
        }
        weightRules = sorted;
        // The server still needs a flat charge; use the heaviest band so it is never too low
        flatCharge = sorted[sorted.length - 1]?.charge ?? 0;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      { name: name.trim(), estimateText: estimate.trim(), charge: flatCharge, weightRules },
      {
        onSuccess: (result) => onDone(zone ? `"${result.zone.name}" saved.` : `"${result.zone.name}" created. Add cities to it below.`),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <label htmlFor="zone-name" className="block text-sm font-medium">
        Zone name <span className="font-normal text-muted">(only you see this)</span>
      </label>
      <input
        id="zone-name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder="Major cities"
        className={`input-field ${fieldErrors.name ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldErrors.name} />

      <label htmlFor="zone-estimate" className="mt-4 block text-sm font-medium">
        Delivery time shown to customers
      </label>
      <input
        id="zone-estimate"
        value={estimate}
        maxLength={60}
        onChange={(e) => setEstimate(e.target.value)}
        placeholder="2–4 working days"
        className={`input-field ${fieldErrors.estimate ? 'border-danger' : ''}`}
      />
      <p className="mt-1.5 text-xs text-muted">Use the time your courier gives for these cities. Don't promise faster.</p>
      <FieldError message={fieldErrors.estimate} />

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">How to charge</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ['flat', 'Same charge for every order'],
              ['weight', 'By parcel weight'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                mode === value ? 'border-ink bg-canvas' : 'border-line hover:border-ink'
              }`}
            >
              <input type="radio" name="zone-mode" checked={mode === value} onChange={() => setMode(value)} className="accent-sage" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'flat' ? (
        <div className="mt-4">
          <label htmlFor="zone-charge" className="block text-sm font-medium">
            Delivery charge (Rs)
          </label>
          <input
            id="zone-charge"
            type="number"
            inputMode="numeric"
            min={0}
            value={charge}
            onChange={(e) => setCharge(e.target.value)}
            placeholder="250"
            className={`input-field sm:w-48 ${fieldErrors.charge ? 'border-danger' : ''}`}
          />
          <FieldError message={fieldErrors.charge} />
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xs text-muted">
            The parcel weight is the total of each size's shipping weight. A parcel heavier than every band pays the last band's
            charge.
          </p>
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 text-xs font-medium text-muted">
              <span>Up to (grams)</span>
              <span>Charge (Rs)</span>
              <span className="sr-only">Remove</span>
            </div>
            {rules.map((rule, i) => (
              <div key={rule.key} className="grid grid-cols-[1fr_1fr_2.5rem] items-center gap-2">
                <div>
                  <label htmlFor={`rule-g-${rule.key}`} className="sr-only">
                    Band {i + 1}: up to how many grams
                  </label>
                  <input
                    id={`rule-g-${rule.key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={rule.upToGrams}
                    onChange={(e) => updateRule(rule.key, { upToGrams: e.target.value })}
                    className="input-field mt-0"
                  />
                </div>
                <div>
                  <label htmlFor={`rule-c-${rule.key}`} className="sr-only">
                    Band {i + 1}: charge in rupees
                  </label>
                  <input
                    id={`rule-c-${rule.key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rule.charge}
                    onChange={(e) => updateRule(rule.key, { charge: e.target.value })}
                    className="input-field mt-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRules((prev) => prev.filter((r) => r.key !== rule.key))}
                  disabled={rules.length === 1}
                  aria-label={`Remove band ${i + 1}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-danger disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {rules.length < 20 && (
            <button type="button" onClick={addRule} className="mt-3 inline-flex items-center gap-1 text-sm text-sage hover:underline">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a band
            </button>
          )}
          <FieldError message={fieldErrors.rules} />
          {rules.every((r) => isWhole(r.upToGrams, 1, 100_000) && isWhole(r.charge, 0, 100_000)) && rules.length > 0 && (
            <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
              {[...rules]
                .sort((a, b) => Number(a.upToGrams) - Number(b.upToGrams))
                .map((r) => `up to ${formatGrams(Number(r.upToGrams))}: ${formatRs(Number(r.charge))}`)
                .join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {zone ? 'Save zone' : 'Create zone'}
        </button>
      </div>
    </form>
  );
}

export default function ZoneDialog({ open, ...props }: ZoneFormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={props.zone ? `Edit "${props.zone.name}"` : 'New delivery zone'}>
      <ZoneForm {...props} />
    </Modal>
  );
}