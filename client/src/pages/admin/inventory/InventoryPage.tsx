import { useState } from 'react';
import { Link } from 'react-router';
import { Ban, CalendarClock, ChevronDown, CircleCheck, PackageMinus, Search, type LucideIcon } from 'lucide-react';
import type { AdminProduct } from '../../../api/catalog';
import type { MovementType } from '../../../api/inventory';
import Badge from '../../../components/ui/Badge';
import Skeleton from '../../../components/ui/Skeleton';
import { EmptyState, ListSkeleton, Panel, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { useStockAlerts } from '../../../features/admin/dashboard/queries';
import { MOVEMENT_LABELS } from '../../../features/admin/inventory/batchStatus';
import MovementsTable from '../../../features/admin/inventory/MovementsTable';
import { PRODUCT_STATUS_LABELS } from '../../../features/admin/products/productStatus';
import { useProduct, useProductList } from '../../../features/admin/products/queries';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatIsoDay } from '../../../lib/format';

// ── Alerts ───────────────────────────────────────────

interface AlertRow {
  key: string;
  title: string;
  detail: string;
  value: string;
  to: string;
}

function AlertPanel({
  icon: Icon,
  tone,
  title,
  note,
  rows,
  empty,
}: {
  icon: LucideIcon;
  tone: 'danger' | 'warning';
  title: string;
  note?: string;
  rows: AlertRow[];
  empty: string;
}) {
  return (
    <Panel title={title} subtitle={note}>
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
          <CircleCheck className="h-4 w-4 text-sage" aria-hidden="true" />
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.key}>
              <Link to={row.to} className="flex items-start justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-canvas">
                <span className="flex min-w-0 gap-2">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'danger' ? 'text-danger' : 'text-warning'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate">{row.title}</span>
                    <span className="block truncate text-xs text-muted">{row.detail}</span>
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums">{row.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// Expiry alerts carry names but no IDs, so they open a product search
const productSearch = (name: string) => `/admin/products?search=${encodeURIComponent(name)}`;

function Alerts() {
  const alerts = useStockAlerts();

  if (alerts.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (alerts.isError) {
    return (
      <div className="card">
        <PanelError error={alerts.error} onRetry={() => void alerts.refetch()} />
      </div>
    );
  }

  const { stoppedSelling, expiringSoon, lowStock, days } = alerts.data;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <AlertPanel
        icon={Ban}
        tone="danger"
        title={`Stopped selling (${stoppedSelling.length})`}
        note="Past the sell-by cutoff. Write them off."
        empty="Nothing past its cutoff."
        rows={stoppedSelling.map((b) => ({
          key: b.batchId,
          title: `${b.product} · ${b.label}`,
          detail: `Batch ${b.batchNumber} · expires ${formatIsoDay(b.expiryDate)}`,
          value: `${b.quantityRemaining} left`,
          to: productSearch(b.product),
        }))}
      />
      <AlertPanel
        icon={CalendarClock}
        tone="warning"
        title={`Expiring within ${days} days (${expiringSoon.length})`}
        note="Sell these first, or plan a discount."
        empty={`Nothing expiring in the next ${days} days.`}
        rows={expiringSoon.map((b) => ({
          key: b.batchId,
          title: `${b.product} · ${b.label}`,
          detail: `Batch ${b.batchNumber} · stops selling ${formatIsoDay(b.stopsSellingOn)}`,
          value: `${b.daysToExpiry} days`,
          to: productSearch(b.product),
        }))}
      />
      <AlertPanel
        icon={PackageMinus}
        tone="warning"
        title={`Low stock (${lowStock.length})`}
        note="At or below the alert level. Reorder soon."
        empty="Every size is above its alert level."
        rows={lowStock.map((v) => ({
          key: v.variantId,
          title: `${v.product} · ${v.label}`,
          detail: `SKU ${v.sku} · alert at ${v.threshold}`,
          value: `${v.availableQty} left`,
          to: `/admin/inventory/${v.productId}/${v.variantId}`,
        }))}
      />
    </div>
  );
}

// ── Stock by product ─────────────────────────────────

function ProductStockRow({ product }: { product: AdminProduct }) {
  const [open, setOpen] = useState(false);
  const detail = useProduct(open ? product._id : undefined); // sizes load only when opened
  const panelId = `sizes-${product._id}`;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{product.name}</span>
          <span className="block truncate text-xs text-muted">
            {product.category?.name ?? '—'} · {PRODUCT_STATUS_LABELS[product.status]}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {product.minPrice !== undefined && (
            <Badge tone={product.inStock ? 'success' : 'danger'}>{product.inStock ? 'In stock' : 'Out of stock'}</Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div id={panelId} className="border-t border-line bg-canvas px-4 py-3">
          {detail.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : detail.isError ? (
            <p className="text-xs text-danger">Could not load the sizes. Close and open again.</p>
          ) : detail.data.variants.filter((v) => v.status !== 'archived').length === 0 ? (
            <p className="text-sm text-muted">
              No sizes yet.{' '}
              <Link to={`/admin/products/${product._id}`} className="text-sage underline-offset-4 hover:underline">
                Add sizes
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.data.variants
                .filter((v) => v.status !== 'archived')
                .map((v) => (
                  <li key={v._id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                    <span>
                      {v.label} <span className="text-xs text-muted">· {v.sku}</span>
                      {v.status === 'unavailable' && <span className="text-xs text-warning"> · unavailable</span>}
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="tabular-nums">
                        <span className={`font-medium ${v.availableQty === 0 ? 'text-danger' : ''}`}>{v.availableQty}</span>
                        <span className="text-muted"> available</span>
                        {v.reservedQty > 0 && <span className="text-muted"> · {v.reservedQty} reserved</span>}
                      </span>
                      <Link to={`/admin/inventory/${product._id}/${v._id}`} className="text-xs text-sage underline-offset-4 hover:underline">
                        Batches<span className="sr-only"> for {v.label}</span>
                      </Link>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function ProductFinder() {
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim(), 400);
  const products = useProductList({ search: search || undefined, limit: 8 });

  return (
    <Panel title="Stock by product" subtitle={search ? `Results for "${search}"` : 'Recently changed products'}>
      <div className="border-b border-line p-4">
        <label htmlFor="inventory-search" className="sr-only">
          Find a product
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="inventory-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Find a product"
            className="input-field mt-0 pl-10"
          />
        </div>
      </div>
      {products.isPending ? (
        <ListSkeleton rows={4} />
      ) : products.isError ? (
        <PanelError error={products.error} onRetry={() => void products.refetch()} />
      ) : products.data.items.length === 0 ? (
        <EmptyState icon={Search} title="No products found" text="Try another word from the name or description." />
      ) : (
        <ul className={`divide-y divide-line ${products.isPlaceholderData ? 'opacity-60' : ''}`}>
          {products.data.items.map((p) => (
            <ProductStockRow key={p._id} product={p} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── Page ─────────────────────────────────────────────

const MOVEMENT_TYPES = Object.keys(MOVEMENT_LABELS) as MovementType[];

export default function InventoryPage() {
  const [type, setType] = useState<MovementType | ''>('');

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-medium">Inventory</h1>
        <p className="mt-1 text-sm text-muted">Stock alerts, every size's batches, and every stock change.</p>
      </header>

      <Alerts />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ProductFinder />
        </div>
        <div className="space-y-3 lg:col-span-3">
          <div className="flex items-center justify-end gap-2">
            <label htmlFor="movement-type" className="text-xs font-medium text-muted">
              Show
            </label>
            <select
              id="movement-type"
              value={type}
              onChange={(e) => setType(e.target.value as MovementType | '')}
              className="input-field mt-0 w-auto py-1.5"
            >
              <option value="">All stock changes</option>
              {MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {/* key: a new filter starts again from page 1 */}
          <MovementsTable key={type || 'all'} filter={{ type: type || undefined }} showProduct title="All stock movements" />
        </div>
      </div>
    </div>
  );
}