import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImageOff, Loader2, SearchX } from "lucide-react";
import { ApiError } from "../../../api/client";
import {
  productsAdminApi,
  type AdminProduct,
  type ProductInput,
} from "../../../api/catalog";
import FormAlert from "../../../components/ui/FormAlert";
import ChipListInput from "../../../components/ui/ChipListInput";
import Skeleton from "../../../components/ui/Skeleton";
import {
  Panel,
  PanelError,
} from "../../../features/admin/dashboard/DashboardPanel";
import ProductStatusPanel from "../../../features/admin/products/ProductStatusPanel";
import {
  PRODUCTS_KEY,
  useCategories,
  useProduct,
} from "../../../features/admin/products/queries";
import { SLUG_PATTERN, slugify } from "../../../lib/slugify";
import SizesCard from "../../../features/admin/products/SizesCard";

// ── Form values ──────────────────────────────────────

const TEXT_FIELDS = [
  "name",
  "shortDescription",
  "description",
  "ingredients",
  "allergens",
  "storageInstructions",
  "usageDirections",
  "origin",
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

interface Values extends Record<TextField, string> {
  category: string;
  slug: string;
  claims: string[];
  tags: string[];
  seoTitle: string;
  seoDescription: string;
}

function valuesFrom(product?: AdminProduct): Values {
  return {
    name: product?.name ?? "",
    shortDescription: product?.shortDescription ?? "",
    description: product?.description ?? "",
    ingredients: product?.ingredients ?? "",
    allergens: product?.allergens ?? "",
    storageInstructions: product?.storageInstructions ?? "",
    usageDirections: product?.usageDirections ?? "",
    origin: product?.origin ?? "",
    category: product?.category?._id ?? "",
    slug: product?.slug ?? "",
    claims: product?.claims ?? [],
    tags: product?.tags ?? [],
    seoTitle: product?.seo?.title ?? "",
    seoDescription: product?.seo?.description ?? "",
  };
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// Only what changed, so the audit log shows real edits
function changedFields(initial: Values, current: Values): ProductInput {
  const body: ProductInput = {};
  for (const field of TEXT_FIELDS) {
    if (current[field].trim() !== initial[field].trim())
      body[field] = current[field].trim();
  }
  if (current.category !== initial.category) body.category = current.category;
  if (current.slug.trim() !== initial.slug) body.slug = current.slug.trim();
  if (!sameList(current.claims, initial.claims)) body.claims = current.claims;
  if (!sameList(current.tags, initial.tags)) body.tags = current.tags;
  if (
    current.seoTitle.trim() !== initial.seoTitle ||
    current.seoDescription.trim() !== initial.seoDescription
  ) {
    body.seo = {
      title: current.seoTitle.trim(),
      description: current.seoDescription.trim(),
    };
  }
  return body;
}

// ── Small field helpers (outside the form, so React keeps their state) ──

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1.5 text-xs text-danger">{message}</p>
  ) : null;
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${value.length > max * 0.9 ? "text-warning" : "text-muted"}`}>
      {value.length}/{max}
    </span>
  );
}

interface TextAreaFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  max: number;
  rows?: number;
  error?: string;
  onChange: (value: string) => void;
}

function TextAreaField({
  id,
  label,
  hint,
  value,
  max,
  rows = 3,
  error,
  onChange,
}: TextAreaFieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        <Counter value={value} max={max} />
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <textarea
        id={id}
        rows={rows}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`input-field resize-y ${error ? "border-danger" : ""}`}
      />
      <FieldError message={error} />
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="space-y-4 p-4">{children}</div>
    </Panel>
  );
}

// ── The form ─────────────────────────────────────────

interface ProductFormProps {
  product?: AdminProduct; // missing = new product
  onSaved: (id: string, created: boolean) => void;
}

function ProductForm({ product, onSaved }: ProductFormProps) {
  const queryClient = useQueryClient();
  const categories = useCategories();
  const initial = valuesFrom(product);
  const [values, setValues] = useState<Values>(initial);
  const [editSlug, setEditSlug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isNew = !product;
  const archived = product?.status === "archived";
  const changes = isNew ? null : changedFields(initial, values);
  const dirty = isNew
    ? values.name.trim() !== ""
    : Object.keys(changes ?? {}).length > 0;
  const slugPreview = values.slug.trim() || slugify(values.name);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const mutation = useMutation({
    mutationFn: (body: ProductInput) =>
      isNew
        ? productsAdminApi.create(
            body as ProductInput & { name: string; category: string },
          )
        : productsAdminApi.update(product._id, body),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      onSaved(result.product._id, isNew);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(
          Object.fromEntries(
            err.details.map((d) => [
              d.field.replace(/^seo\./, "seo"),
              d.message,
            ]),
          ),
        );
      } else {
        setError(
          "Could not reach the server. Check your connection and try again.",
        );
      }
    },
  });

  function set<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    if (values.name.trim().length < 2)
      errors.name = "Product name must be at least 2 characters";
    if (!values.category) errors.category = "Choose a category";
    if (values.slug.trim() && !SLUG_PATTERN.test(values.slug.trim()))
      errors.slug = "Use lowercase letters, numbers and single hyphens only";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    if (isNew) {
      const body: ProductInput = {
        name: values.name.trim(),
        category: values.category,
      };
      for (const field of TEXT_FIELDS)
        if (field !== "name" && values[field].trim())
          body[field] = values[field].trim();
      if (values.slug.trim()) body.slug = values.slug.trim();
      if (values.claims.length) body.claims = values.claims;
      if (values.tags.length) body.tags = values.tags;
      if (values.seoTitle.trim() || values.seoDescription.trim())
        body.seo = {
          title: values.seoTitle.trim() || undefined,
          description: values.seoDescription.trim() || undefined,
        };
      mutation.mutate(body);
    } else if (changes && Object.keys(changes).length > 0) {
      mutation.mutate(changes);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 pb-24">
      {archived && (
        <FormAlert tone="warning" className="">
          This product is archived, so it can't be edited. Restore it as a draft
          first.
        </FormAlert>
      )}
      {error && (
        <FormAlert tone="danger" className="">
          {error}
        </FormAlert>
      )}

      <fieldset disabled={archived} className="space-y-6">
        <Section title="Basics">
          <div>
            <label htmlFor="p-name" className="block text-sm font-medium">
              Product name
            </label>
            <input
              id="p-name"
              value={values.name}
              maxLength={120}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Himalayan Shilajit Resin"
              aria-invalid={!!fieldErrors.name}
              className={`input-field ${fieldErrors.name ? "border-danger" : ""}`}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div>
            <p className="text-sm font-medium">Web address</p>
            {editSlug || fieldErrors.slug ? (
              <>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  <span className="shrink-0 text-muted">/products/</span>
                  <input
                    id="p-slug"
                    aria-label="Web address"
                    value={values.slug}
                    maxLength={140}
                    onChange={(e) => set("slug", e.target.value.toLowerCase())}
                    placeholder={slugify(values.name)}
                    className={`input-field mt-0 ${fieldErrors.slug ? "border-danger" : ""}`}
                  />
                </div>
                {!isNew && (
                  <p className="mt-1.5 text-xs text-warning">
                    Changing it breaks links people have already shared.
                  </p>
                )}
                <FieldError message={fieldErrors.slug} />
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">
                /products/<span className="text-ink">{slugPreview || "…"}</span>{" "}
                <button
                  type="button"
                  onClick={() => setEditSlug(true)}
                  className="ml-1 text-xs text-sage underline-offset-4 hover:underline">
                  Edit
                </button>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="p-category" className="block text-sm font-medium">
              Category
            </label>
            <select
              id="p-category"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              aria-invalid={!!fieldErrors.category}
              className={`input-field ${fieldErrors.category ? "border-danger" : ""}`}>
              <option value="">Choose a category</option>
              {categories.data?.categories
                .filter(
                  (c) => c.status !== "archived" || c._id === values.category,
                )
                .map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.status !== "active" ? ` (${c.status})` : ""}
                  </option>
                ))}
            </select>
            <FieldError message={fieldErrors.category} />
          </div>

          <TextAreaField
            id="p-short"
            label="Short description"
            hint="One or two lines for product cards and search results."
            value={values.shortDescription}
            max={200}
            rows={2}
            error={fieldErrors.shortDescription}
            onChange={(v) => set("shortDescription", v)}
          />
        </Section>

        <Section title="Description">
          <TextAreaField
            id="p-description"
            label="Full description"
            value={values.description}
            max={5000}
            rows={7}
            error={fieldErrors.description}
            onChange={(v) => set("description", v)}
          />
        </Section>

        <Section
          title="Product details"
          subtitle="Shown on the product page. Leave empty what doesn't apply.">
          <TextAreaField
            id="p-ingredients"
            label="Ingredients"
            value={values.ingredients}
            max={2000}
            error={fieldErrors.ingredients}
            onChange={(v) => set("ingredients", v)}
          />
          <TextAreaField
            id="p-allergens"
            label="Allergens"
            hint='For example "Contains tree nuts (walnut)". Write "None known" only if you are sure.'
            value={values.allergens}
            max={2000}
            rows={2}
            error={fieldErrors.allergens}
            onChange={(v) => set("allergens", v)}
          />
          <TextAreaField
            id="p-storage"
            label="Storage instructions"
            value={values.storageInstructions}
            max={2000}
            rows={2}
            error={fieldErrors.storageInstructions}
            onChange={(v) => set("storageInstructions", v)}
          />
          <TextAreaField
            id="p-usage"
            label="How to use"
            value={values.usageDirections}
            max={2000}
            error={fieldErrors.usageDirections}
            onChange={(v) => set("usageDirections", v)}
          />
          <div>
            <label htmlFor="p-origin" className="block text-sm font-medium">
              Origin
            </label>
            <input
              id="p-origin"
              value={values.origin}
              maxLength={200}
              onChange={(e) => set("origin", e.target.value)}
              placeholder="Skardu, Gilgit-Baltistan"
              className={`input-field ${fieldErrors.origin ? "border-danger" : ""}`}
            />
            <FieldError message={fieldErrors.origin} />
          </div>
        </Section>

        <Section title="Claims and tags">
          <div>
            <label htmlFor="p-claims" className="block text-sm font-medium">
              Product claims
            </label>
            <p id="p-claims-help" className="mt-0.5 text-xs text-muted">
              Only claims you're allowed to make and can back up, for example
              "Sun-dried" or "No added sugar". Up to 20.
            </p>
            <div className="mt-2">
              <ChipListInput
                id="p-claims"
                values={values.claims}
                onChange={(v) => set("claims", v)}
                max={20}
                maxLength={200}
                placeholder="Type a claim and press Enter"
                describedBy="p-claims-help"
              />
            </div>
            <FieldError message={fieldErrors.claims} />
          </div>
          <div>
            <label htmlFor="p-tags" className="block text-sm font-medium">
              Tags
            </label>
            <p id="p-tags-help" className="mt-0.5 text-xs text-muted">
              Help customers find it in search. Up to 20.
            </p>
            <div className="mt-2">
              <ChipListInput
                id="p-tags"
                values={values.tags}
                onChange={(v) => set("tags", v)}
                max={20}
                maxLength={40}
                lowercase
                placeholder="apricot, dry fruit…"
                describedBy="p-tags-help"
              />
            </div>
            <FieldError message={fieldErrors.tags} />
          </div>
        </Section>

        <Section
          title="Search engines"
          subtitle="Optional. Leave empty to use the name and short description.">
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="p-seo-title"
                className="block text-sm font-medium">
                Page title
              </label>
              <Counter value={values.seoTitle} max={70} />
            </div>
            <input
              id="p-seo-title"
              value={values.seoTitle}
              maxLength={70}
              onChange={(e) => set("seoTitle", e.target.value)}
              className={`input-field ${fieldErrors.seo ? "border-danger" : ""}`}
            />
          </div>
          <TextAreaField
            id="p-seo-description"
            label="Page description"
            value={values.seoDescription}
            max={160}
            rows={2}
            error={fieldErrors.seo}
            onChange={(v) => set("seoDescription", v)}
          />
        </Section>
      </fieldset>

      {/* Save bar stays at the bottom of the screen */}
      {!archived && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:left-64">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
            <span className="mr-auto text-xs text-muted">
              {mutation.isPending
                ? "Saving…"
                : dirty
                  ? "You have unsaved changes"
                  : isNew
                    ? ""
                    : "All changes saved"}
            </span>
            <button
              type="submit"
              disabled={!dirty || mutation.isPending}
              className="btn-primary gap-2">
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {isNew ? "Create product" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ── Page ─────────────────────────────────────────────

function PhotosPlaceholder() {
  return (
    <Panel title="Photos and certificates">
      <div className="flex items-start gap-3 p-4 text-sm text-muted">
        <ImageOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Photo and certificate uploads arrive once the image storage account
          (Cloudinary) is set up on the server.
        </p>
      </div>
    </Panel>
  );
}

export default function ProductFormPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !productId;
  const query = useProduct(productId);
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  function onSaved(id: string, created: boolean) {
    if (created) {
      navigate(`/admin/products/${id}`, {
        replace: true,
        state: {
          notice:
            "Product created as a draft. Add its sizes and prices next, then publish it.",
        },
      });
    } else {
      setNotice("Changes saved.");
    }
  }

  const backLink = (
    <Link
      to="/admin/products"
      className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All products
    </Link>
  );

  if (!isNew && query.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {backLink}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isNew && query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {backLink}
        {notFound ? (
          <section className="card mx-auto mt-8 max-w-md p-8 text-center">
            <SearchX
              className="mx-auto h-8 w-8 text-muted"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-xl font-medium">Product not found</h1>
            <Link to="/admin/products" className="btn-primary mt-6">
              Go to products
            </Link>
          </section>
        ) : (
          <div className="card">
            <PanelError
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          </div>
        )}
      </div>
    );
  }

  const product = query.data?.product;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-3">
        {backLink}
        <h1 className="text-2xl font-medium">
          {product ? product.name : "New product"}
        </h1>
      </div>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {product && query.data && (
            <SizesCard product={product} variants={query.data.variants} />
          )}
          {/* key: after each save the form restarts from what the server now has */}
          <ProductForm
            key={product ? `${product._id}-${product.updatedAt}` : "new"}
            product={product}
            onSaved={onSaved}
          />
        </div>
        <div className="space-y-6">
          {product && <ProductStatusPanel product={product} />}
          <PhotosPlaceholder />
        </div>
      </div>
    </div>
  );
}
