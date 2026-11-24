import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { categoriesAdminApi, type AdminCategory, type CategoryInput } from '../../../api/catalog';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { SLUG_PATTERN, slugify } from '../../../lib/slugify';
import { CATEGORIES_KEY, PRODUCTS_KEY } from '../products/queries';

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-danger">{message}</p> : null;
}

interface FormProps {
  category?: AdminCategory; // missing = new category
  onClose: () => void;
  onSaved: (message: string) => void;
}

function CategoryForm({ category, onClose, onSaved }: FormProps) {
  const queryClient = useQueryClient();
  const isNew = !category;

  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [editSlug, setEditSlug] = useState(false);
  const [description, setDescription] = useState(category?.description ?? '');
  const [sortOrder, setSortOrder] = useState(category?.sortOrder !== undefined ? String(category.sortOrder) : '');
  const [startHidden, setStartHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (body: CategoryInput) =>
      isNew
        ? categoriesAdminApi.create(body as CategoryInput & { name: string })
        : categoriesAdminApi.update(category._id, body),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      onSaved(isNew ? `"${result.category.name}" added.` : `"${result.category.name}" updated.`);
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

  const slugPreview = slug.trim() || slugify(name).slice(0, 80);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    const order = sortOrder === '' ? undefined : Number(sortOrder);
    if (name.trim().length < 2) errors.name = 'Category name must be at least 2 characters';
    if (slug.trim() && !SLUG_PATTERN.test(slug.trim())) errors.slug = 'Use lowercase letters, numbers and single hyphens only';
    if (order !== undefined && (!Number.isInteger(order) || order < 0 || order > 9999)) errors.sortOrder = 'Enter 0 to 9999';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (isNew) {
      mutation.mutate({
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        sortOrder: order,
        status: startHidden ? 'hidden' : 'active',
      });
      return;
    }

    const body: CategoryInput = {};
    if (name.trim() !== category.name) body.name = name.trim();
    if (slug.trim() && slug.trim() !== category.slug) body.slug = slug.trim();
    if (description.trim() !== (category.description ?? '')) body.description = description.trim();
    if (order !== undefined && order !== category.sortOrder) body.sortOrder = order;
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(body);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <label htmlFor="c-name" className="block text-sm font-medium">
        Name
      </label>
      <input
        id="c-name"
        value={name}
        maxLength={60}
        onChange={(e) => {
          setName(e.target.value);
          setFieldErrors((p) => ({ ...p, name: '' }));
        }}
        placeholder="Dry Fruits"
        className={`input-field ${fieldErrors.name ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldErrors.name} />

      <p className="mt-4 text-sm font-medium">Web address</p>
      {editSlug || fieldErrors.slug ? (
        <>
          <div className="mt-1 flex items-center gap-1 text-sm">
            <span className="shrink-0 text-muted">/category/</span>
            <input
              aria-label="Web address"
              value={slug}
              maxLength={80}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder={slugify(name)}
              className={`input-field mt-0 ${fieldErrors.slug ? 'border-danger' : ''}`}
            />
          </div>
          {!isNew && <p className="mt-1.5 text-xs text-warning">Changing it breaks links people have already shared.</p>}
          <FieldError message={fieldErrors.slug} />
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">
          /category/<span className="text-ink">{slugPreview || '…'}</span>{' '}
          <button type="button" onClick={() => setEditSlug(true)} className="ml-1 text-xs text-sage underline-offset-4 hover:underline">
            Edit
          </button>
        </p>
      )}

      <div className="mt-4 flex items-baseline justify-between">
        <label htmlFor="c-description" className="block text-sm font-medium">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <span className="text-xs tabular-nums text-muted">{description.length}/500</span>
      </div>
      <textarea
        id="c-description"
        rows={3}
        maxLength={500}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Shown at the top of the category page"
        className="input-field resize-y"
      />

      <label htmlFor="c-order" className="mt-4 block text-sm font-medium">
        Order in the menu <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id="c-order"
        inputMode="numeric"
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value)}
        placeholder="0 comes first"
        className={`input-field w-40 ${fieldErrors.sortOrder ? 'border-danger' : ''}`}
      />
      <FieldError message={fieldErrors.sortOrder} />

      {isNew && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm">
          <input
            type="checkbox"
            checked={startHidden}
            onChange={(e) => setStartHidden(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]"
          />
          <span>
            <span className="block font-medium">Keep hidden until ready</span>
            <span className="block text-xs text-muted">It won't appear in the store menu until you show it.</span>
          </span>
        </label>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isNew ? 'Add category' : 'Save category'}
        </button>
      </div>
    </form>
  );
}

export default function CategoryDialog({ open, ...props }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={props.category ? `Edit ${props.category.name}` : 'Add a category'}>
      <CategoryForm {...props} />
    </Modal>
  );
}