import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Loader2, Plus } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { categoriesAdminApi, type AdminCategory, type CategoryStatus } from '../../../api/catalog';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import Skeleton from '../../../components/ui/Skeleton';
import CategoryDialog from '../../../features/admin/categories/CategoryDialog';
import {
  CATEGORY_STATUS_HELP,
  CATEGORY_STATUS_LABELS,
  CATEGORY_STATUS_TONES,
} from '../../../features/admin/categories/categoryStatus';
import { EmptyState, ListSkeleton, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { CATEGORIES_KEY, PRODUCTS_KEY, useCategories, useProductList } from '../../../features/admin/products/queries';

type DialogState = { kind: 'new' } | { kind: 'edit' | 'archive'; id: string } | null;

function ProductCount({ categoryId }: { categoryId: string }) {
  const query = useProductList({ category: categoryId, limit: 1 });
  if (query.isPending) return <Skeleton className="h-4 w-16" />;
  if (query.isError) return <span className="text-muted">—</span>;
  const total = query.data.total;
  return (
    <Link to={`/admin/products?category=${categoryId}`} className="text-sage underline-offset-4 hover:underline">
      {total} {total === 1 ? 'product' : 'products'}
    </Link>
  );
}

function StatusButtons({
  category,
  busy,
  onChange,
  onArchive,
}: {
  category: AdminCategory;
  busy: boolean;
  onChange: (status: CategoryStatus) => void;
  onArchive: () => void;
}) {
  const s = category.status;
  const linkClass = 'text-xs text-sage underline-offset-4 hover:underline disabled:opacity-50';
  return (
    <span className="inline-flex flex-wrap gap-3">
      {s === 'active' && (
        <button type="button" disabled={busy} onClick={() => onChange('hidden')} className={linkClass}>
          Hide
        </button>
      )}
      {s === 'hidden' && (
        <button type="button" disabled={busy} onClick={() => onChange('active')} className={linkClass}>
          Show
        </button>
      )}
      {s !== 'archived' && (
        <button type="button" disabled={busy} onClick={onArchive} className="text-xs text-danger underline-offset-4 hover:underline disabled:opacity-50">
          Archive
        </button>
      )}
      {s === 'archived' && (
        <button type="button" disabled={busy} onClick={() => onChange('hidden')} className={linkClass}>
          Restore (hidden)
        </button>
      )}
    </span>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: CategoryStatus }) => categoriesAdminApi.changeStatus(id, next),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      setDialog(null);
      setNotice({
        text: `"${result.category.name}" is now ${CATEGORY_STATUS_LABELS[result.category.status].toLowerCase()}.`,
        tone: 'success',
      });
    },
    onError: (err) => {
      setDialog(null);
      setNotice({ text: err instanceof ApiError ? err.message : 'Could not reach the server. Try again.', tone: 'danger' });
    },
  });

  const list = categories.data?.categories ?? [];
  const selected = dialog && dialog.kind !== 'new' ? list.find((c) => c._id === dialog.id) : undefined;
  const change = (id: string, next: CategoryStatus) => {
    setNotice(null);
    status.mutate({ id, next });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Categories</h1>
          <p className="mt-1 text-sm text-muted">How products are grouped in the store menu.</p>
        </div>
        <button type="button" onClick={() => setDialog({ kind: 'new' })} className="btn-primary gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add category
        </button>
      </header>

      {notice && (
        <FormAlert tone={notice.tone} className="">
          {notice.text}
        </FormAlert>
      )}

      <section className="card overflow-hidden" aria-label="Categories">
        {categories.isPending ? (
          <ListSkeleton rows={3} />
        ) : categories.isError ? (
          <PanelError error={categories.error} onRetry={() => void categories.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon={FolderTree} title="No categories yet" text="Add your first one, for example Silajeet, Dry Fruits or Organic Oils." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c._id} className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 py-4 ${c.status === 'archived' ? 'text-muted' : ''}`}>
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {c.name}
                    <Badge tone={CATEGORY_STATUS_TONES[c.status]}>{CATEGORY_STATUS_LABELS[c.status]}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    /category/{c.slug} · order {c.sortOrder ?? 0} · {CATEGORY_STATUS_HELP[c.status]}
                  </p>
                  {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>}
                </div>
                <div className="flex flex-col items-start gap-2 text-sm sm:items-end">
                  <ProductCount categoryId={c._id} />
                  <span className="inline-flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'edit', id: c._id })}
                      className="text-xs text-sage underline-offset-4 hover:underline"
                    >
                      Edit<span className="sr-only"> {c.name}</span>
                    </button>
                    <StatusButtons
                      category={c}
                      busy={status.isPending}
                      onChange={(next) => change(c._id, next)}
                      onArchive={() => setDialog({ kind: 'archive', id: c._id })}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CategoryDialog
        open={dialog?.kind === 'new' || dialog?.kind === 'edit'}
        category={dialog?.kind === 'edit' ? selected : undefined}
        onClose={() => setDialog(null)}
        onSaved={(text) => {
          setDialog(null);
          setNotice({ text, tone: 'success' });
        }}
      />

      <Modal
        open={dialog?.kind === 'archive' && Boolean(selected)}
        onClose={() => setDialog(null)}
        title={`Archive ${selected?.name ?? 'this category'}?`}
      >
        <p className="text-sm text-muted">
          It leaves the store menu and new products can't use it. Products already in it keep it. A category with published
          products can't be archived until they're unpublished or moved.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setDialog(null)} className="btn-secondary">
            Keep it
          </button>
          <button
            type="button"
            disabled={status.isPending || !selected}
            onClick={() => selected && change(selected._id, 'archived')}
            className="btn-danger gap-2"
          >
            {status.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Archive category
          </button>
        </div>
      </Modal>
    </div>
  );
}