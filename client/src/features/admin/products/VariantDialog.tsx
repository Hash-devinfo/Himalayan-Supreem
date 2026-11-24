import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import {
  variantsAdminApi,
  type AdminProduct,
  type AdminVariant,
  type SizeUnit,
  type VariantInput,
  type VariantStatus,
} from '../../../api/catalog';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { formatRs } from '../../../lib/format';
import { DASHBOARD_KEY } from '../dashboard/queries';
import { PRODUCTS_KEY } from './queries';
import {
  DEFAULT_LOW_STOCK,
  SIZE_UNITS,
  VARIANT_STATUS_HELP,
  VARIANT_STATUS_LABELS,
  VARIANT_STATUS_TONES,
} from './variantStatus';

// "Himalayan Shilajit Resin", 15, g -> "HSR-15G"
function suggestSku(productName: string, sizeValue: string, unit: SizeUnit): string {
  const initials = productName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((word) => word[0])
    .join('');
  const size = sizeValue.replace('.', '').replace(/[^0-9]/g, '');
  return [initials || 'SKU', size ? `${size}${unit.toUpperCase()}` : ''].filter(Boolean).join('-').slice(0, 40);
}

// Contents weight in grams (1 ml counted as about 1 g); packaging is added by the admin
function contentsGrams(sizeValue: string, unit: SizeUnit): string {
  const n = Number(sizeValue);
  if (!Number.isFinite(n) || n <= 0 || unit === 'pcs') return '';
  return String(Math.round(unit === 'kg' || unit === 'l' ? n * 1000 : n));
}

const isWhole = (n: number) => Number.isInteger(n) && n >= 0;

interface Values {
  label: string;
  sizeValue: string;
  sizeUnit: SizeUnit;
  sku: string;
  price: string;
  costPrice: string;
  shippingWeightGrams: string;
  lowStockThreshold: string;
  sortOrder: string;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-danger">{message}</p> : null;
}

interface FormProps {
  product: AdminProduct;
  variant?: AdminVariant;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function VariantForm({ product, variant, onClose, onSaved }: FormProps) {
  const queryClient = useQueryClient();
  const isNew = !variant;
  const archived = variant?.status === 'archived';

  const [values, setValues] = useState<Values>(() => ({
    label: variant?.label ?? '',
    sizeValue: variant ? String(variant.sizeValue) : '',
    sizeUnit: variant?.sizeUnit ?? 'g',
    sku: variant?.sku ?? '',
    price: variant ? String(variant.price) : '',
    costPrice: variant?.costPrice !== undefined ? String(variant.costPrice) : '',
    shippingWeightGrams: variant ? String(variant.shippingWeightGrams) : '',
    lowStockThreshold: variant?.lowStockThreshold !== undefined ? String(variant.lowStockThreshold) : '',
    sortOrder: variant ? String(variant.sortOrder) : '',
  }));
  // New sizes get suggestions until the admin types their own
  const [skuTouched, setSkuTouched] = useState(!isNew);
  const [weightTouched, setWeightTouched] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const sku = skuTouched ? values.sku : suggestSku(product.name, values.sizeValue, values.sizeUnit);
  const weight = weightTouched ? values.shippingWeightGrams : contentsGrams(values.sizeValue, values.sizeUnit);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };

  const save = useMutation({
    mutationFn: (body: VariantInput) =>
      isNew
        ? variantsAdminApi.create(product._id, body as Parameters<typeof variantsAdminApi.create>[1])
        : variantsAdminApi.update(product._id, variant._id, body),
    onSuccess: () => {
      invalidate();
      onSaved(isNew ? 'Size added. Add stock for it in Inventory.' : 'Size updated.');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      } else {
        setError('Could not reach the server. Try again.');
      }
    },
  });

  const status = useMutation({
    mutationFn: (next: VariantStatus) => variantsAdminApi.changeStatus(product._id, variant!._id, next),
    onSuccess: (result) => {
      invalidate();
      onSaved(`${result.variant.label} is now ${VARIANT_STATUS_LABELS[result.variant.status].toLowerCase()}.`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
  });

  function set<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  }

  // Margin preview
  const priceNum = Number(values.price);
  const costNum = Number(values.costPrice);
  const showMargin = values.price !== '' && values.costPrice !== '' && isWhole(priceNum) && isWhole(costNum) && priceNum > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    const sizeValue = Number(values.sizeValue);
    const price = Number(values.price);
    const weightNum = Number(weight);
    const threshold = values.lowStockThreshold === '' ? undefined : Number(values.lowStockThreshold);
    const cost = values.costPrice === '' ? undefined : Number(values.costPrice);
    const sortOrder = values.sortOrder === '' ? undefined : Number(values.sortOrder);

    if (!values.label.trim()) errors.label = 'Give the size a label, like "250 g pouch"';
    if (!(sizeValue > 0)) errors.sizeValue = 'Enter a size greater than 0';
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(sku)) errors.sku = 'Use capital letters, numbers and single hyphens';
    if (values.price === '' || !isWhole(price)) errors.price = 'Enter the price in whole rupees';
    if (cost !== undefined && !isWhole(cost)) errors.costPrice = 'Enter whole rupees';
    if (!Number.isInteger(weightNum) || weightNum < 1) errors.shippingWeightGrams = 'Enter the packed weight in grams (at least 1)';
    if (threshold !== undefined && !isWhole(threshold)) errors.lowStockThreshold = 'Enter a whole number';
    if (sortOrder !== undefined && (!isWhole(sortOrder) || sortOrder > 9999)) errors.sortOrder = 'Enter 0 to 9999';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const next: VariantInput = {
      label: values.label.trim(),
      sizeValue,
      sizeUnit: values.sizeUnit,
      sku,
      price,
      costPrice: cost,
      shippingWeightGrams: weightNum,
      lowStockThreshold: threshold,
      sortOrder,
    };

    if (isNew) {
      save.mutate(next);
      return;
    }
    // Only what changed (empty optional boxes leave the saved value as it is)
    const body: VariantInput = {};
    if (next.label !== variant.label) body.label = next.label;
    if (next.sizeValue !== variant.sizeValue) body.sizeValue = next.sizeValue;
    if (next.sizeUnit !== variant.sizeUnit) body.sizeUnit = next.sizeUnit;
    if (next.sku !== variant.sku) body.sku = next.sku;
    if (next.price !== variant.price) body.price = next.price;
    if (cost !== undefined && cost !== variant.costPrice) body.costPrice = cost;
    if (next.shippingWeightGrams !== variant.shippingWeightGrams) body.shippingWeightGrams = next.shippingWeightGrams;
    if (threshold !== undefined && threshold !== variant.lowStockThreshold) body.lowStockThreshold = threshold;
    if (sortOrder !== undefined && sortOrder !== variant.sortOrder) body.sortOrder = sortOrder;

    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    save.mutate(body);
  }

  const inputClass = (field: string) => `input-field ${fieldErrors[field] ? 'border-danger' : ''}`;
  const busy = save.isPending || status.isPending;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      {archived && <FormAlert tone="warning">This size is archived. Restore it below to edit it.</FormAlert>}

      <fieldset disabled={archived} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="v-label" className="block text-sm font-medium">Label</label>
          <input id="v-label" value={values.label} maxLength={40} onChange={(e) => set('label', e.target.value)} placeholder="250 g pouch" className={inputClass('label')} />
          <FieldError message={fieldErrors.label} />
        </div>

        <div>
          <label htmlFor="v-size" className="block text-sm font-medium">Size</label>
          <input id="v-size" inputMode="decimal" value={values.sizeValue} onChange={(e) => set('sizeValue', e.target.value)} placeholder="250" className={inputClass('sizeValue')} />
          <FieldError message={fieldErrors.sizeValue} />
        </div>
        <div>
          <label htmlFor="v-unit" className="block text-sm font-medium">Unit</label>
          <select id="v-unit" value={values.sizeUnit} onChange={(e) => set('sizeUnit', e.target.value as SizeUnit)} className={inputClass('sizeUnit')}>
            {SIZE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="v-sku" className="block text-sm font-medium">SKU</label>
          <input
            id="v-sku"
            value={sku}
            maxLength={40}
            onChange={(e) => {
              setSkuTouched(true);
              set('sku', e.target.value.toUpperCase().replace(/\s+/g, '-'));
            }}
            spellCheck={false}
            className={`${inputClass('sku')} font-medium tracking-wide`}
          />
          {!skuTouched && <p className="mt-1.5 text-xs text-muted">Suggested from the name and size. Type to change it.</p>}
          <FieldError message={fieldErrors.sku} />
        </div>

        <div>
          <label htmlFor="v-price" className="block text-sm font-medium">Price (Rs)</label>
          <input id="v-price" inputMode="numeric" value={values.price} onChange={(e) => set('price', e.target.value)} className={inputClass('price')} />
          <FieldError message={fieldErrors.price} />
        </div>
        <div>
          <label htmlFor="v-cost" className="block text-sm font-medium">
            Cost (Rs) <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="v-cost" inputMode="numeric" value={values.costPrice} onChange={(e) => set('costPrice', e.target.value)} placeholder="For profit reports" className={inputClass('costPrice')} />
          <FieldError message={fieldErrors.costPrice} />
        </div>
        {showMargin && (
          <p className={`sm:col-span-2 -mt-2 text-xs ${priceNum - costNum < 0 ? 'text-danger' : 'text-sage'}`}>
            {formatRs(priceNum - costNum)} {priceNum - costNum < 0 ? 'loss' : 'profit'} per unit ·{' '}
            {Math.round(((priceNum - costNum) / priceNum) * 100)}% of the price
          </p>
        )}

        <div>
          <label htmlFor="v-weight" className="block text-sm font-medium">Shipping weight (g)</label>
          <input
            id="v-weight"
            inputMode="numeric"
            value={weight}
            onChange={(e) => {
              setWeightTouched(true);
              set('shippingWeightGrams', e.target.value);
            }}
            className={inputClass('shippingWeightGrams')}
          />
          <p className="mt-1.5 text-xs text-muted">Packed weight, including the jar or pouch. Used for delivery charges.</p>
          <FieldError message={fieldErrors.shippingWeightGrams} />
        </div>
        <div>
          <label htmlFor="v-low" className="block text-sm font-medium">
            Low-stock alert <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="v-low"
            inputMode="numeric"
            value={values.lowStockThreshold}
            onChange={(e) => set('lowStockThreshold', e.target.value)}
            placeholder={`Store default (${DEFAULT_LOW_STOCK})`}
            className={inputClass('lowStockThreshold')}
          />
          <p className="mt-1.5 text-xs text-muted">Warn when this many or fewer are left.</p>
          <FieldError message={fieldErrors.lowStockThreshold} />
        </div>

        <div>
          <label htmlFor="v-sort" className="block text-sm font-medium">
            Order on the page <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="v-sort" inputMode="numeric" value={values.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} placeholder="Smallest first" className={inputClass('sortOrder')} />
          <FieldError message={fieldErrors.sortOrder} />
        </div>
      </fieldset>

      {variant && (
        <div className="mt-6 rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Status <Badge tone={VARIANT_STATUS_TONES[variant.status]}>{VARIANT_STATUS_LABELS[variant.status]}</Badge>
            </p>
            <div className="flex flex-wrap gap-2">
              {variant.status !== 'active' && (
                <button type="button" disabled={busy} onClick={() => status.mutate('active')} className="btn-secondary px-3 py-1.5">
                  {variant.status === 'archived' ? 'Restore' : 'Make active'}
                </button>
              )}
              {variant.status === 'active' && (
                <button type="button" disabled={busy} onClick={() => status.mutate('unavailable')} className="btn-secondary px-3 py-1.5">
                  Make unavailable
                </button>
              )}
              {variant.status !== 'archived' && (
                <button type="button" disabled={busy} onClick={() => status.mutate('archived')} className="btn-secondary px-3 py-1.5 text-danger">
                  Archive
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">{VARIANT_STATUS_HELP[variant.status]}</p>
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        {!archived && (
          <button type="submit" disabled={busy} className="btn-primary gap-2">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isNew ? 'Add size' : 'Save size'}
          </button>
        )}
      </div>
    </form>
  );
}

export default function VariantDialog({ open, ...props }: FormProps & { open: boolean }) {
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={props.variant ? `Edit ${props.variant.label}` : 'Add a size'}
      description={props.product.name}
    >
      <VariantForm {...props} />
    </Modal>
  );
}