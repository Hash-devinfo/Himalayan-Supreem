import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Package, Plus, Search, X } from 'lucide-react';
import type { ProductListQuery, ProductStatus } from '../../../api/catalog';
import Badge from '../../../components/ui/Badge';
import Pagination from '../../../components/ui/Pagination';
import Skeleton from '../../../components/ui/Skeleton';
import { EmptyState, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { PRODUCT_STATUSES, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from '../../../features/admin/products/productStatus';
import { useCategories, useProductList } from '../../../features/admin/products/queries';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatRs, timeAgo } from '../../../lib/format';

const PAGE_SIZE = 20;

function priceRange(min?: number, max?: number): string {
  if (min === undefined) return 'No sizes yet';
  return min === max ? formatRs(min) : `${formatRs(min)} – ${formatRs(max ?? min)}`;
}

export default function ProductsListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = PRODUCT_STATUSES.find((s) => s === params.get('status')) as ProductStatus | undefined;
  const category = params.get('category') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const search = useDebouncedValue(searchText.trim(), 400);

  function updateParams(changes: Record<string, string | undefined>, keepPage = false) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!keepPage) next.delete('page');
      return next;
    });
  }

  const query: ProductListQuery = {
    status,
    category: category || undefined,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  };
  const products = useProductList(query);
  const categories = useCategories();
  const filtersActive = Boolean(status || category || searchText.trim());

  function clearFilters() {
    setSearchText('');
    setParams({});
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Products</h1>
          <p className="mt-1 text-sm text-muted">Everything you sell. Prices and stock live on each size.</p>
        </div>
        <Link to="/admin/products/new" className="btn-primary gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New product
        </Link>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[undefined, ...PRODUCT_STATUSES].map((value) => {
          const selected = status === value;
          return (
            <button
              key={value ?? 'all'}
              type="button"
              aria-pressed={selected}
              onClick={() => updateParams({ status: value })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selected ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {value ? PRODUCT_STATUS_LABELS[value] : 'All'}
            </button>
          );
        })}
      </div>

      <div className="card grid gap-3 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
        <div>
          <label htmlFor="product-search" className="block text-xs font-medium text-muted">
            Search
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="product-search"
              type="search"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (page !== 1) updateParams({});
              }}
              placeholder="Product name or word in the description"
              className="input-field mt-0 pl-10"
            />
          </div>
        </div>
        <div>
          <label htmlFor="product-category" className="block text-xs font-medium text-muted">
            Category
          </label>
          <select
            id="product-category"
            value={category}
            onChange={(e) => updateParams({ category: e.target.value || undefined })}
            className="input-field mt-1"
          >
            <option value="">All categories</option>
            {categories.data?.categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.status !== 'active' ? ` (${c.status})` : ''}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={clearFilters} disabled={!filtersActive} className="btn-secondary gap-1.5 px-4 py-2.5">
          <X className="h-4 w-4" aria-hidden="true" />
          Clear
        </button>
      </div>

      <section className="card overflow-hidden" aria-label="Products" aria-busy={products.isFetching}>
        {products.isPending ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : products.isError ? (
          <PanelError error={products.error} onRetry={() => void products.refetch()} />
        ) : products.data.items.length === 0 ? (
          filtersActive ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium">No products match these filters</p>
              <button type="button" onClick={clearFilters} className="btn-secondary mt-4 px-4 py-1.5">
                Clear filters
              </button>
            </div>
          ) : (
            <EmptyState icon={Package} title="No products yet" text="Add your first product, then give it sizes and prices." />
          )
        ) : (
          <div className={`transition-opacity ${products.isPlaceholderData ? 'opacity-60' : ''}`}>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Category</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Stock</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.data.items.map((p) => (
                  <tr
                    key={p._id}
                    onClick={() => navigate(`/admin/products/${p._id}`)}
                    className="cursor-pointer transition-colors hover:bg-canvas"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/products/${p._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">/{p.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{priceRange(p.minPrice, p.maxPrice)}</td>
                    <td className="px-4 py-3">
                      {p.minPrice === undefined ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <Badge tone={p.inStock ? 'success' : 'danger'}>{p.inStock ? 'In stock' : 'Out of stock'}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={PRODUCT_STATUS_TONES[p.status]}>{PRODUCT_STATUS_LABELS[p.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted">{timeAgo(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {products.data.items.map((p) => (
                <li key={p._id}>
                  <Link to={`/admin/products/${p._id}`} className="block px-4 py-3 transition-colors hover:bg-canvas">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {p.category?.name ?? '—'} · {priceRange(p.minPrice, p.maxPrice)}
                        </p>
                      </div>
                      <Badge tone={PRODUCT_STATUS_TONES[p.status]}>{PRODUCT_STATUS_LABELS[p.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {products.data && products.data.total > 0 && (
        <Pagination
          page={page}
          pages={products.data.totalPages}
          total={products.data.total}
          noun={products.data.total === 1 ? 'product' : 'products'}
          onPage={(next) => {
            updateParams({ page: String(next) }, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}