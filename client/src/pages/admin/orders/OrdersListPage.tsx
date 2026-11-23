import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { RefreshCw, Search, ShoppingBag, X } from 'lucide-react';
import type { OrderFlag, OrderListQuery, OrderStatus } from '../../../api/orders';
import Badge from '../../../components/ui/Badge';
import Pagination from '../../../components/ui/Pagination';
import Skeleton from '../../../components/ui/Skeleton';
import { EmptyState, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import OrderFlags from '../../../features/admin/orders/OrderFlags';
import {
  ORDER_FLAG_LABELS,
  STATUS_CHIPS,
  orderStatusTone,
  parseOrderFlag,
  parseOrderStatus,
} from '../../../features/admin/orders/orderStatus';
import { useOrderList, useOrderStatusCounts } from '../../../features/admin/orders/queries';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatCount, formatRs, timeAgo } from '../../../lib/format';

const PAGE_SIZE = 20;

function Chip({
  selected,
  label,
  count,
  onClick,
}: {
  selected: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-sage ${
        selected ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`tabular-nums text-xs ${selected ? 'text-canvas/80' : 'text-muted'}`}>{formatCount(count)}</span>
      )}
    </button>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function OrdersListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Filters live in the URL, so dashboard links and the Back button work
  const status = parseOrderStatus(params.get('status'));
  const flag = parseOrderFlag(params.get('flag'));
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  // Search runs 0.4 s after typing stops
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

  const query: OrderListQuery = {
    status,
    flag,
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const orders = useOrderList(query);
  const counts = useOrderStatusCounts();
  const filtersActive = Boolean(status || flag || from || to || searchText.trim());

  function clearFilters() {
    setSearchText('');
    setParams({});
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Orders</h1>
          <p className="mt-1 text-sm text-muted">Confirm by phone, then pack, ship and track every order.</p>
        </div>
        <button
          type="button"
          onClick={() => void orders.refetch()}
          disabled={orders.isFetching}
          className="btn-secondary gap-2 px-4 py-2"
        >
          <RefreshCw className={`h-4 w-4 ${orders.isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {/* Status chips */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <div className="flex w-max gap-2" role="group" aria-label="Filter by status">
          <Chip selected={!status} label="All" onClick={() => updateParams({ status: undefined })} />
          {STATUS_CHIPS.map((chip) => (
            <Chip
              key={chip.status}
              selected={status === chip.status}
              label={chip.label}
              count={counts.data?.[chip.status]}
              onClick={() => updateParams({ status: chip.status satisfies OrderStatus })}
            />
          ))}
        </div>
      </div>

      {/* Search and filters */}
      <div className="card grid gap-3 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] md:items-end">
        <div>
          <label htmlFor="order-search" className="block text-xs font-medium text-muted">
            Search
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="order-search"
              type="search"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (page !== 1) updateParams({}, false);
              }}
              placeholder="Order number, phone or name"
              className="input-field mt-0 pl-10"
            />
          </div>
        </div>

        <div>
          <label htmlFor="order-flag" className="block text-xs font-medium text-muted">
            Needs attention
          </label>
          <select
            id="order-flag"
            value={flag ?? ''}
            onChange={(e) => updateParams({ flag: (e.target.value as OrderFlag) || undefined })}
            className="input-field mt-1"
          >
            <option value="">Any order</option>
            {(Object.keys(ORDER_FLAG_LABELS) as OrderFlag[]).map((key) => (
              <option key={key} value={key}>
                {ORDER_FLAG_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="order-from" className="block text-xs font-medium text-muted">
              From
            </label>
            <input
              id="order-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => updateParams({ from: e.target.value || undefined })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label htmlFor="order-to" className="block text-xs font-medium text-muted">
              To
            </label>
            <input
              id="order-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => updateParams({ to: e.target.value || undefined })}
              className="input-field mt-1"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          disabled={!filtersActive}
          className="btn-secondary gap-1.5 px-4 py-2.5"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Clear
        </button>
      </div>

      {/* Results */}
      <section className="card relative overflow-hidden" aria-label="Orders" aria-busy={orders.isFetching}>
        {orders.isFetching && !orders.isPending && (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden="true">
            <div className="h-full w-1/3 bg-sage motion-safe:animate-pulse" />
          </div>
        )}

        {orders.isPending ? (
          <TableSkeleton />
        ) : orders.isError ? (
          <PanelError error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.data.orders.length === 0 ? (
          filtersActive ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium">No orders match these filters</p>
              <p className="mt-1 text-xs text-muted">Try a different search, status or date range.</p>
              <button type="button" onClick={clearFilters} className="btn-secondary mt-4 px-4 py-1.5">
                Clear filters
              </button>
            </div>
          ) : (
            <EmptyState icon={ShoppingBag} title="No orders yet" text="Orders from the website show up here straight away." />
          )
        ) : (
          <div className={`transition-opacity ${orders.isPlaceholderData ? 'opacity-60' : ''}`}>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Order</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Items</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Calls</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.data.orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.orderNumber}`)}
                    className="cursor-pointer align-top transition-colors hover:bg-canvas"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/orders/${order.orderNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">{timeAgo(order.placedAt)}</p>
                      <div className="mt-1.5">
                        <OrderFlags order={order} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p>{order.customerName}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {order.phone} · {order.city}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCount(order.units)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{order.calls || '–'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatRs(order.total)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={orderStatusTone(order.status)}>{order.statusLabel}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phone cards */}
            <ul className="divide-y divide-line md:hidden">
              {orders.data.orders.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/admin/orders/${order.orderNumber}`}
                    className="block px-4 py-3 transition-colors hover:bg-canvas"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{order.orderNumber}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {order.customerName} · {order.city} · {timeAgo(order.placedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-medium tabular-nums">{formatRs(order.total)}</span>
                        <Badge tone={orderStatusTone(order.status)}>{order.statusLabel}</Badge>
                      </div>
                    </div>
                    <div className="mt-2">
                      <OrderFlags order={order} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {orders.data && orders.data.total > 0 && (
        <Pagination
          page={page}
          pages={orders.data.pages}
          total={orders.data.total}
          noun={orders.data.total === 1 ? 'order' : 'orders'}
          onPage={(next) => {
            updateParams({ page: String(next) }, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}