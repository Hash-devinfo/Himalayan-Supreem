import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import {
  promotionsApi,
  type CreatePromotionInput,
  type DiscountType,
  type Promotion,
  type PromotionType,
  type UpdatePromotionInput,
} from '../../../api/promotions';
import FormAlert from '../../../components/ui/FormAlert';
import { formatRs, pktDateString } from '../../../lib/format';
import { discountText, errorText, stateLabel, TYPE_HELP, TYPE_LABELS } from './promotionText';
import { usePromotionMutation } from './queries';
import { CategoryPicker, ProductPicker } from './TargetPicker';

type CreatableType = Exclude<PromotionType, 'welcome'>;
type Scope = 'store' | 'products' | 'categories';

const CREATABLE: CreatableType[] = ['code', 'product', 'category', 'seasonal'];
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,29}$/;

// '' = not set; otherwise a whole number in range
const wholeOrEmpty = (text: string, min: number) => text.trim() === '' || (Number.isInteger(Number(text)) && Number(text) >= min);
const numberOrNull = (text: string) => (text.trim() === '' ? null : Number(text));
const numberOrUndefined = (text: string) => (text.trim() === '' ? undefined : Number(text));

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-danger">{message}</p>;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

interface PromotionFormProps {
  promotion?: Promotion; // missing = new promotion
  onSaved: (promotion: Promotion, message: string) => void;
}

export default function PromotionForm({ promotion, onSaved }: PromotionFormProps) {
  const editing = Boolean(promotion);
  const locked = promotion?.status === 'ended';

  const [type, setType] = useState<CreatableType>(
    promotion && promotion.type !== 'welcome' ? promotion.type : 'code',
  );
  const [name, setName] = useState(promotion?.name ?? '');
  const [code, setCode] = useState(promotion?.code ?? '');
  const [discountType, setDiscountType] = useState<DiscountType>(promotion?.discountType ?? 'percent');
  const [value, setValue] = useState(promotion ? String(promotion.value) : '');
  const [maxDiscount, setMaxDiscount] = useState(promotion?.maxDiscount ? String(promotion.maxDiscount) : '');
  const [scope, setScope] = useState<Scope>(
    promotion?.products.length ? 'products' : promotion?.categories.length ? 'categories' : 'store',
  );
  const [products, setProducts] = useState<string[]>(promotion?.products ?? []);
  const [categories, setCategories] = useState<string[]>(promotion?.categories ?? []);
  const [minOrder, setMinOrder] = useState(promotion?.minOrderTotal ? String(promotion.minOrderTotal) : '');
  const [usageLimit, setUsageLimit] = useState(promotion?.usageLimit ? String(promotion.usageLimit) : '');
  const [perCustomer, setPerCustomer] = useState(promotion?.perCustomerLimit ? String(promotion.perCustomerLimit) : '');
  const [startsOn, setStartsOn] = useState(promotion?.startsOn ?? pktDateString());
  const [endsOn, setEndsOn] = useState(promotion?.endsOn ?? '');
  const [startPaused, setStartPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isCode = type === 'code';
  // The server refuses a new code once customers have used the old one
  const codeLocked = Boolean(promotion && promotion.usageCount > 0);
  // Product and category sales always target their own kind; codes and seasonal offers can be store-wide
  const effectiveScope: Scope = type === 'product' ? 'products' : type === 'category' ? 'categories' : scope;

  const mutation = usePromotionMutation((body: CreatePromotionInput | UpdatePromotionInput) =>
    promotion ? promotionsApi.update(promotion.id, body as UpdatePromotionInput) : promotionsApi.create(body as CreatePromotionInput),
  );

  function clear(field: string) {
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    const n = Number(value);
    if (name.trim().length < 2) errors.name = 'Give it a name customers will see, e.g. "Eid sale"';
    if (isCode && !CODE_PATTERN.test(code.trim().toUpperCase())) errors.code = '3–30 letters, numbers or dashes, e.g. EID10';
    if (!Number.isInteger(n) || n < 1) errors.value = discountType === 'percent' ? 'Enter a percentage from 1 to 100' : 'Enter the amount in whole rupees';
    else if (discountType === 'percent' && n > 100) errors.value = 'A percentage cannot be more than 100';
    if (isCode && discountType === 'percent' && !wholeOrEmpty(maxDiscount, 1)) errors.maxDiscount = 'Whole rupees, or leave empty';
    if (effectiveScope === 'products' && products.length === 0) errors.products = 'Choose at least one product';
    if (effectiveScope === 'categories' && categories.length === 0) errors.categories = 'Choose at least one category';
    if (isCode) {
      if (!wholeOrEmpty(minOrder, 0)) errors.minOrderTotal = 'Whole rupees, or leave empty';
      if (!wholeOrEmpty(usageLimit, 1)) errors.usageLimit = 'A whole number, or leave empty for no limit';
      if (!wholeOrEmpty(perCustomer, 1)) errors.perCustomerLimit = 'A whole number, or leave empty for no limit';
      else if (usageLimit && perCustomer && Number(perCustomer) > Number(usageLimit)) {
        errors.perCustomerLimit = "Can't be more than the total usage limit";
      }
    }
    if (!startsOn) errors.startsOn = 'Choose a start date';
    if (type === 'seasonal' && !endsOn) errors.endsOn = 'A seasonal offer needs an end date';
    if (startsOn && endsOn && endsOn < startsOn) errors.endsOn = 'The end date must be on or after the start date';
    return errors;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setError('Please fix the highlighted fields.');
      return;
    }

    const targets = {
      products: effectiveScope === 'products' ? products : [],
      categories: effectiveScope === 'categories' ? categories : [],
    };
    const percentCode = isCode && discountType === 'percent';

    const body: CreatePromotionInput | UpdatePromotionInput = promotion
      ? {
          name: name.trim(),
          ...(isCode ? { code: code.trim().toUpperCase() } : {}),
          discountType,
          value: Number(value),
          maxDiscount: percentCode ? numberOrNull(maxDiscount) : null,
          ...targets,
          minOrderTotal: isCode ? numberOrNull(minOrder) : null,
          startsOn,
          endsOn: endsOn || null,
          usageLimit: isCode ? numberOrNull(usageLimit) : null,
          perCustomerLimit: isCode ? numberOrNull(perCustomer) : null,
        }
      : {
          name: name.trim(),
          type,
          ...(isCode ? { code: code.trim().toUpperCase() } : {}),
          discountType,
          value: Number(value),
          ...(percentCode ? { maxDiscount: numberOrUndefined(maxDiscount) } : {}),
          ...targets,
          ...(isCode
            ? {
                minOrderTotal: numberOrUndefined(minOrder),
                usageLimit: numberOrUndefined(usageLimit),
                perCustomerLimit: numberOrUndefined(perCustomer),
              }
            : {}),
          startsOn,
          endsOn: endsOn || undefined,
          status: startPaused ? 'paused' : 'active',
        };

    mutation.mutate(body, {
      onSuccess: (result) =>
        onSaved(result.promotion, editing ? `"${result.promotion.name}" saved.` : `"${result.promotion.name}" created: ${stateLabel(result.promotion.state)}.`),
      onError: (err) => {
        setError(errorText(err));
        // The server lists each problem by field; show them under the fields
        if (err instanceof ApiError && err.details.length > 0) {
          setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
        }
      },
    });
  }

  const preview = Number.isInteger(Number(value)) && Number(value) >= 1
    ? discountText({ discountType, value: Number(value), maxDiscount: isCode && discountType === 'percent' && maxDiscount ? Number(maxDiscount) : undefined })
    : null;

  const choice = (active: boolean) =>
    `flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
      active ? 'border-ink bg-canvas' : 'border-line hover:border-ink'
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {locked && (
        <FormAlert tone="warning" className="">
          This promotion has ended and can't be changed. Create a new one instead.
        </FormAlert>
      )}
      {error && (
        <FormAlert tone="danger" className="">
          {error}
        </FormAlert>
      )}

      <fieldset disabled={locked || mutation.isPending} className="space-y-5">
        <Section title="Type" hint={editing ? "The type can't change after creating." : undefined}>
          <div className="grid gap-2 sm:grid-cols-2">
            {CREATABLE.map((t) => (
              <label key={t} className={`${choice(type === t)} ${editing && type !== t ? 'hidden' : ''}`}>
                <input
                  type="radio"
                  name="promo-type"
                  checked={type === t}
                  disabled={editing}
                  onChange={() => setType(t)}
                  className="mt-0.5 accent-sage"
                />
                <span>
                  <span className="font-medium">{TYPE_LABELS[t]}</span>
                  <span className="block text-xs text-muted">{TYPE_HELP[t]}</span>
                </span>
              </label>
            ))}
          </div>
          {!editing && (
            <p className="mt-3 text-xs text-muted">
              Welcome discounts, members-only offers and bundles come later, with customer accounts.
            </p>
          )}
        </Section>

        <Section title="Details">
          <label htmlFor="promo-name" className="block text-sm font-medium">
            Name <span className="font-normal text-muted">(customers see this in the cart)</span>
          </label>
          <input
            id="promo-name"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              clear('name');
            }}
            placeholder="Eid sale"
            className={`input-field ${fieldErrors.name ? 'border-danger' : ''}`}
          />
          <FieldError message={fieldErrors.name} />

          {isCode && (
            <>
              <label htmlFor="promo-code" className="mt-4 block text-sm font-medium">
                Code
              </label>
              <input
                id="promo-code"
                value={code}
                maxLength={30}
                readOnly={codeLocked}
                autoCapitalize="characters"
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/\s/g, ''));
                  clear('code');
                }}
                placeholder="EID10"
                className={`input-field font-mono uppercase sm:w-64 ${codeLocked ? 'bg-canvas text-muted' : ''} ${fieldErrors.code ? 'border-danger' : ''}`}
              />
              {codeLocked && (
                <p className="mt-1.5 text-xs text-muted">Customers have used this code, so it can't be changed.</p>
              )}
              <FieldError message={fieldErrors.code} />
            </>
          )}
        </Section>

        <Section title="Discount">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['percent', 'Percentage off'],
                ['fixed', 'Fixed amount off (Rs)'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className={choice(discountType === v)}>
                <input
                  type="radio"
                  name="promo-discount-type"
                  checked={discountType === v}
                  onChange={() => {
                    setDiscountType(v);
                    clear('value');
                  }}
                  className="mt-0.5 accent-sage"
                />
                {label}
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-value" className="block text-sm font-medium">
                {discountType === 'percent' ? 'Percentage' : 'Amount (Rs)'}
              </label>
              <input
                id="promo-value"
                type="number"
                inputMode="numeric"
                min={1}
                max={discountType === 'percent' ? 100 : undefined}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  clear('value');
                }}
                placeholder={discountType === 'percent' ? '10' : '200'}
                className={`input-field ${fieldErrors.value ? 'border-danger' : ''}`}
              />
              <FieldError message={fieldErrors.value} />
              {discountType === 'fixed' && (
                <p className="mt-1.5 text-xs text-muted">
                  {isCode ? 'Taken off the order once.' : 'Taken off each unit of the products it applies to.'}
                </p>
              )}
            </div>
            {isCode && discountType === 'percent' && (
              <div>
                <label htmlFor="promo-max" className="block text-sm font-medium">
                  Most it can take off (Rs) <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="promo-max"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={maxDiscount}
                  onChange={(e) => {
                    setMaxDiscount(e.target.value);
                    clear('maxDiscount');
                  }}
                  placeholder="500"
                  className={`input-field ${fieldErrors.maxDiscount ? 'border-danger' : ''}`}
                />
                <FieldError message={fieldErrors.maxDiscount} />
              </div>
            )}
          </div>
          {preview && (
            <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-sm">
              Customers get <span className="font-medium">{preview}</span>
              {isCode && minOrder ? ` on orders of ${formatRs(Number(minOrder) || 0)} or more` : ''}.
            </p>
          )}
        </Section>

        <Section title="Applies to">
          {(type === 'code' || type === 'seasonal') && (
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ['store', 'Whole store'],
                  ['products', 'Some products'],
                  ['categories', 'Some categories'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className={choice(scope === v)}>
                  <input type="radio" name="promo-scope" checked={scope === v} onChange={() => setScope(v)} className="mt-0.5 accent-sage" />
                  {label}
                </label>
              ))}
            </div>
          )}
          {effectiveScope === 'store' && <p className="text-sm text-muted">Every product in the store.</p>}
          {effectiveScope === 'products' && (
            <>
              <ProductPicker
                selected={products}
                onChange={(ids) => {
                  setProducts(ids);
                  clear('products');
                }}
                invalid={Boolean(fieldErrors.products)}
              />
              <FieldError message={fieldErrors.products} />
            </>
          )}
          {effectiveScope === 'categories' && (
            <>
              <CategoryPicker
                selected={categories}
                onChange={(ids) => {
                  setCategories(ids);
                  clear('categories');
                }}
                invalid={Boolean(fieldErrors.categories)}
              />
              <FieldError message={fieldErrors.categories} />
            </>
          )}
          {isCode && (
            <p className="mt-3 text-xs text-muted">Codes don't apply to items that already have an automatic sale price.</p>
          )}
          {!isCode && (
            <p className="mt-3 text-xs text-muted">If two sales cover the same item, the customer gets the bigger discount. They don't add up.</p>
          )}
        </Section>

        {isCode && (
          <Section title="Conditions and limits" hint="Leave a box empty for no limit.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="promo-min" className="block text-sm font-medium">
                  Minimum order (Rs)
                </label>
                <input
                  id="promo-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={minOrder}
                  onChange={(e) => {
                    setMinOrder(e.target.value);
                    clear('minOrderTotal');
                  }}
                  className={`input-field ${fieldErrors.minOrderTotal ? 'border-danger' : ''}`}
                />
                <FieldError message={fieldErrors.minOrderTotal} />
              </div>
              <div>
                <label htmlFor="promo-limit" className="block text-sm font-medium">
                  Total uses
                </label>
                <input
                  id="promo-limit"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={usageLimit}
                  onChange={(e) => {
                    setUsageLimit(e.target.value);
                    clear('usageLimit');
                  }}
                  className={`input-field ${fieldErrors.usageLimit ? 'border-danger' : ''}`}
                />
                <FieldError message={fieldErrors.usageLimit} />
              </div>
              <div>
                <label htmlFor="promo-per-customer" className="block text-sm font-medium">
                  Uses per customer
                </label>
                <input
                  id="promo-per-customer"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={perCustomer}
                  onChange={(e) => {
                    setPerCustomer(e.target.value);
                    clear('perCustomerLimit');
                  }}
                  className={`input-field ${fieldErrors.perCustomerLimit ? 'border-danger' : ''}`}
                />
                <FieldError message={fieldErrors.perCustomerLimit} />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">A customer is counted by phone number.</p>
          </Section>
        )}

        <Section title="Dates" hint="Pakistan time. A promotion runs until the end of its last day.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-start" className="block text-sm font-medium">
                Starts on
              </label>
              <input
                id="promo-start"
                type="date"
                value={startsOn}
                onChange={(e) => {
                  setStartsOn(e.target.value);
                  clear('startsOn');
                }}
                className={`input-field ${fieldErrors.startsOn ? 'border-danger' : ''}`}
              />
              <FieldError message={fieldErrors.startsOn} />
            </div>
            <div>
              <label htmlFor="promo-end" className="block text-sm font-medium">
                Last day {type !== 'seasonal' && <span className="font-normal text-muted">(optional)</span>}
              </label>
              <input
                id="promo-end"
                type="date"
                min={startsOn || undefined}
                value={endsOn}
                onChange={(e) => {
                  setEndsOn(e.target.value);
                  clear('endsOn');
                }}
                className={`input-field ${fieldErrors.endsOn ? 'border-danger' : ''}`}
              />
              <FieldError message={fieldErrors.endsOn} />
            </div>
          </div>
          {!editing && (
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={startPaused} onChange={(e) => setStartPaused(e.target.checked)} className="mt-0.5 accent-sage" />
              <span>
                Save as paused
                <span className="block text-xs text-muted">Set it up now and turn it on later.</span>
              </span>
            </label>
          )}
        </Section>
      </fieldset>

      {!locked && (
        <div className="flex justify-end">
          <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Create promotion'}
          </button>
        </div>
      )}
    </form>
  );
}