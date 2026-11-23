import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  CalendarClock,
  CircleCheck,
  MessageSquareWarning,
  PackageMinus,
  PackageOpen,
  PhoneCall,
  RefreshCw,
  ShoppingBag,
  Star,
  Truck,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { ApiError } from '../../api/client';
import Badge from '../../components/ui/Badge';
import FormAlert from '../../components/ui/FormAlert';
import Skeleton from '../../components/ui/Skeleton';
import { useAdminAuth } from '../../features/admin/auth/useAdminAuth';
import {
  DASHBOARD_KEY,
  useModerationCounts,
  useOrderPipeline,
  useRecentOrders,
  useSalesStats,
  useStockAlerts,
} from '../../features/admin/dashboard/queries';
import { orderStatusTone } from '../../features/admin/orders/orderStatus';
import { formatCount, formatDay, formatRs, formatToday, timeAgo } from '../../lib/format';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Building blocks ──────────────────────────────────

interface ActionTileProps {
  icon: LucideIcon;
  label: string;
  value?: number;
  hint?: string;
  to: string;
  loading: boolean;
  failed: boolean;
  urgent?: boolean;
}

function ActionTile({ icon: Icon, label, value = 0, hint, to, loading, failed, urgent }: ActionTileProps) {
  const needsAction = !failed && value > 0;
  const iconClass = needsAction
    ? urgent
      ? 'bg-danger-soft text-danger'
      : 'bg-warning-soft text-warning'
    : 'bg-sage-soft text-sage';

  return (
    <Link
      to={to}
      className="card group flex items-start gap-4 p-4 transition-colors hover:border-sage focus-visible:outline-2 focus-visible:outline-sage"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">{label}</span>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-12" />
        ) : (
          <span className="mt-0.5 block text-2xl font-medium tabular-nums">{failed ? '–' : formatCount(value)}</span>
        )}
        {!loading && (
          <span className={`mt-0.5 block text-xs ${failed ? 'text-danger' : 'text-muted'}`}>
            {failed ? "Couldn't load" : needsAction ? hint : 'All clear'}
          </span>
        )}
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
        aria-hidden="true"
      />
    </Link>
  );
}

interface StatCardProps {
  label: string;
  value?: string;
  sub?: string;
  loading: boolean;
  failed: boolean;
}

function StatCard({ label, value, sub, loading, failed }: StatCardProps) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-medium tabular-nums">{failed ? '–' : value}</p>
      )}
      {!loading && (
        <p className={`mt-1 text-xs ${failed ? 'text-danger' : 'text-muted'}`}>{failed ? "Couldn't load" : sub}</p>
      )}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs text-sage underline-offset-4 hover:underline">
      {children}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

function PanelError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Could not reach the server.';
  return (
    <div className="p-4">
      <FormAlert tone="danger" className="mb-3">
        {message}
      </FormAlert>
      <button type="button" onClick={onRetry} className="btn-secondary px-4 py-1.5">
        Try again
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sage-soft text-sage">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted">{text}</p>
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-5 w-16" />
        </li>
      ))}
    </ul>
  );
}

// ── Panels ───────────────────────────────────────────

function RecentOrders() {
  const query = useRecentOrders();

  return (
    <Panel title="Recent orders" action={<PanelLink to="/admin/orders">View all</PanelLink>}>
      {query.isPending ? (
        <ListSkeleton rows={4} />
      ) : query.isError ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders yet" text="New orders show up here as soon as they're placed." />
      ) : (
        <ul className="divide-y divide-line">
          {query.data.orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/admin/orders/${order.orderNumber}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-canvas"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {order.orderNumber}
                    {order.risk !== 'normal' && (
                      <Badge tone="danger">{order.risk === 'blocked' ? 'Blocked number' : 'High risk'}</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {order.customerName} · {order.city} · {timeAgo(order.placedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-medium tabular-nums">{formatRs(order.total)}</span>
                  <Badge tone={orderStatusTone(order.status)}>{order.statusLabel}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

interface AlertItem {
  key: string;
  primary: string;
  secondary: string;
  value: string;
}

interface AlertGroupProps {
  icon: LucideIcon;
  tone: 'danger' | 'warning';
  title: string;
  note?: string;
  items: AlertItem[];
  more: number;
}

function AlertGroup({ icon: Icon, tone, title, note, items, more }: AlertGroupProps) {
  return (
    <div className="px-4 py-3">
      <p className={`flex items-center gap-2 text-xs font-medium ${tone === 'danger' ? 'text-danger' : 'text-warning'}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {title}
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{item.primary}</span>
              <span className="block truncate text-xs text-muted">{item.secondary}</span>
            </span>
            <span className="shrink-0 text-xs font-medium tabular-nums">{item.value}</span>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-2 text-xs text-muted">and {more} more</p>}
    </div>
  );
}

function StockAlerts() {
  const query = useStockAlerts();
  const SHOW = 3;

  return (
    <Panel title="Stock alerts" action={<PanelLink to="/admin/inventory">Inventory</PanelLink>}>
      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.stoppedSelling.length + query.data.expiringSoon.length + query.data.lowStock.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="All stock is healthy"
          text={`No low stock, and nothing expiring in the next ${query.data.days} days.`}
        />
      ) : (
        <div className="divide-y divide-line">
          {query.data.stoppedSelling.length > 0 && (
            <AlertGroup
              icon={Ban}
              tone="danger"
              title={`Stopped selling (${query.data.stoppedSelling.length})`}
              note="Past the sell-by cutoff, so customers can't buy them. Write them off or remove them."
              items={query.data.stoppedSelling.slice(0, SHOW).map((b) => ({
                key: b.batchId,
                primary: `${b.product} · ${b.label}`,
                secondary: `Batch ${b.batchNumber} · expires ${formatDay(b.expiryDate)}`,
                value: `${b.quantityRemaining} left`,
              }))}
              more={query.data.stoppedSelling.length - SHOW}
            />
          )}
          {query.data.expiringSoon.length > 0 && (
            <AlertGroup
              icon={CalendarClock}
              tone="warning"
              title={`Expiring within ${query.data.days} days (${query.data.expiringSoon.length})`}
              items={query.data.expiringSoon.slice(0, SHOW).map((b) => ({
                key: b.batchId,
                primary: `${b.product} · ${b.label}`,
                secondary: `Batch ${b.batchNumber} · stops selling ${formatDay(b.stopsSellingOn)}`,
                value: `${b.daysToExpiry} days`,
              }))}
              more={query.data.expiringSoon.length - SHOW}
            />
          )}
          {query.data.lowStock.length > 0 && (
            <AlertGroup
              icon={PackageMinus}
              tone="warning"
              title={`Low stock (${query.data.lowStock.length})`}
              items={query.data.lowStock.slice(0, SHOW).map((v) => ({
                key: v.variantId,
                primary: `${v.product} · ${v.label}`,
                secondary: `SKU ${v.sku} · alert at ${v.threshold}`,
                value: `${v.availableQty} left`,
              }))}
              more={query.data.lowStock.length - SHOW}
            />
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Page ─────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { admin } = useAdminAuth();
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: DASHBOARD_KEY }) > 0;

  const pipeline = useOrderPipeline();
  const moderation = useModerationCounts();
  const sales = useSalesStats();

  const p = pipeline.data;
  const m = moderation.data;
  const s = sales.data;
  const firstName = admin?.name.split(' ')[0];

  const callsHint = p
    ? [
        p.newOrders > 0 && `${p.newOrders} new`,
        p.retryCalls > 0 && `${p.retryCalls} to call again`,
        p.lastTry > 0 && `${p.lastTry} on last try`,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted">{formatToday()}</p>
        </div>
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY })}
          disabled={refreshing}
          className="btn-secondary gap-2 px-4 py-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="mb-3 text-sm font-medium text-muted">
          Needs your attention
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile
            icon={PhoneCall}
            label="Calls to make"
            value={p ? p.newOrders + p.retryCalls : undefined}
            hint={callsHint}
            to="/admin/orders?status=new"
            loading={pipeline.isPending}
            failed={pipeline.isError}
            urgent={(p?.lastTry ?? 0) > 0}
          />
          <ActionTile
            icon={PackageOpen}
            label="Ready to pack"
            value={p?.toPack}
            hint="Confirmed, waiting to be packed"
            to="/admin/orders?status=confirmed"
            loading={pipeline.isPending}
            failed={pipeline.isError}
          />
          <ActionTile
            icon={Truck}
            label="Ready to ship"
            value={p?.toShip}
            hint="Packed, waiting for the courier"
            to="/admin/orders?status=packing"
            loading={pipeline.isPending}
            failed={pipeline.isError}
          />
          <ActionTile
            icon={MessageSquareWarning}
            label="Cancellation requests"
            value={p?.cancellationRequests}
            hint="Customers asked to cancel"
            to="/admin/orders?flag=cancellationRequested"
            loading={pipeline.isPending}
            failed={pipeline.isError}
            urgent
          />
          <ActionTile
            icon={Star}
            label="Reviews to check"
            value={m?.pendingReviews}
            hint="Waiting for your approval"
            to="/admin/reviews"
            loading={moderation.isPending}
            failed={moderation.isError}
          />
          <ActionTile
            icon={Undo2}
            label="Refunds"
            value={m ? m.refundsToReview + m.refundsToPay : undefined}
            hint={m ? `${m.refundsToReview} to review · ${m.refundsToPay} to pay` : undefined}
            to="/admin/refunds"
            loading={moderation.isPending}
            failed={moderation.isError}
          />
        </div>
      </section>

      <section aria-labelledby="sales-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sales-heading" className="text-sm font-medium text-muted">
            Sales
          </h2>
          {s && (
            <p className="text-xs text-muted">
              Last 30 days · {formatDay(s.range.from)} – {formatDay(s.range.to)}
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Orders today"
            value={s ? formatCount(s.placedToday) : undefined}
            sub={s ? `${formatCount(s.placedLast30Days)} in the last 30 days` : undefined}
            loading={sales.isPending}
            failed={sales.isError}
          />
          <StatCard
            label="Net sales"
            value={s ? formatRs(s.summary.netSales) : undefined}
            sub={s ? `From ${formatCount(s.summary.deliveredOrders)} delivered orders` : undefined}
            loading={sales.isPending}
            failed={sales.isError}
          />
          <StatCard
            label="Average order"
            value={s ? formatRs(s.summary.averageOrderValue) : undefined}
            sub="Delivered orders, after discounts"
            loading={sales.isPending}
            failed={sales.isError}
          />
          <StatCard
            label="COD with couriers"
            value={p ? formatRs(p.codHeldAmount) : undefined}
            sub={p ? `${formatCount(p.codHeldOrders)} delivered, not yet paid to you` : undefined}
            loading={pipeline.isPending}
            failed={pipeline.isError}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentOrders />
        </div>
        <div className="lg:col-span-2">
          <StockAlerts />
        </div>
      </div>
    </div>
  );
}