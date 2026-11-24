import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, SearchX } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { ordersApi, type OrderDetailResponse } from '../../../api/orders';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Skeleton from '../../../components/ui/Skeleton';
import { Panel, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import OrderActions from '../../../features/admin/orders/actions/OrderActions';
import CustomerCard from '../../../features/admin/orders/detail/CustomerCard';
import DeliveryCard from '../../../features/admin/orders/detail/DeliveryCard';
import { InfoList, InfoRow } from '../../../features/admin/orders/detail/InfoList';
import NotesCard from '../../../features/admin/orders/detail/NotesCard';
import OrderItemsCard from '../../../features/admin/orders/detail/OrderItemsCard';
import OrderTimeline from '../../../features/admin/orders/detail/OrderTimeline';
import { CHANNEL_LABELS } from '../../../features/admin/orders/orderLabels';
import { orderStatusTone } from '../../../features/admin/orders/orderStatus';
import { ORDERS_KEY } from '../../../features/admin/orders/queries';
import { formatDateTime, formatRs, timeAgo } from '../../../lib/format';

function BackLink() {
  const navigate = useNavigate();
  const location = useLocation();
  // Go back to the list with its filters if we came from it; otherwise open the plain list
  const cameFromApp = location.key !== 'default';

  return (
    <button
      type="button"
      onClick={() => (cameFromApp ? navigate(-1) : navigate('/admin/orders'))}
      className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All orders
    </button>
  );
}

function OrderAlerts({ data }: { data: OrderDetailResponse }) {
  const { order, risk } = data;
  const any = risk.level !== 'normal' || order.flags.stockShortfall || order.flags.unlistedCity;
  if (!any) return null;

  return (
    <div className="space-y-2">
      {risk.level === 'blocked' && (
        <FormAlert tone="danger" className="">
          This phone number is blocked{risk.blockedReason ? `: ${risk.blockedReason}` : '.'}
        </FormAlert>
      )}
      {risk.level === 'high' && (
        <FormAlert tone="danger" className="">
          High risk: this number refused or didn't collect {risk.refused} {risk.refused === 1 ? 'parcel' : 'parcels'} before.
          Confirm carefully on the call.
        </FormAlert>
      )}
      {order.flags.stockShortfall && (
        <FormAlert tone="warning" className="">
          There isn't enough sellable stock for this order right now. Restock, or talk to the customer, before packing.
        </FormAlert>
      )}
      {order.flags.unlistedCity && (
        <FormAlert tone="warning" className="">
          The customer typed the city "{order.customerSnapshot.address.city}", which isn't in your delivery list. Check that
          your courier delivers there.
        </FormAlert>
      )}
    </div>
  );
}

function OrderInfoCard({ data }: { data: OrderDetailResponse }) {
  const { order } = data;
  const source = order.source;

  return (
    <Panel title="Order info">
      <InfoList>
        <InfoRow label="Channel">{CHANNEL_LABELS[source?.channel ?? 'website']}</InfoRow>
        <InfoRow label="Placed">{formatDateTime(order.createdAt)}</InfoRow>
        <InfoRow label="Last change">{timeAgo(order.updatedAt)}</InfoRow>
        {source?.utmSource && (
          <InfoRow label="Campaign">
            {[source.utmSource, source.utmMedium, source.utmCampaign].filter(Boolean).join(' · ')}
          </InfoRow>
        )}
        {source?.referrer && (
          <InfoRow label="Came from">
            <span className="break-all">{source.referrer}</span>
          </InfoRow>
        )}
      </InfoList>
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { orderNumber = '' } = useParams();

  const query = useQuery({
    queryKey: [...ORDERS_KEY, 'detail', orderNumber],
    queryFn: () => ordersApi.get(orderNumber),
    refetchInterval: 60_000,
  });

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <BackLink />
        <DetailSkeleton />
      </div>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <BackLink />
        {notFound ? (
          <section className="card mx-auto mt-8 max-w-md p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-sage">
              <SearchX className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-medium">Order not found</h1>
            <p className="mt-2 text-sm text-muted">There's no order "{orderNumber}". Check the number and try again.</p>
            <Link to="/admin/orders" className="btn-primary mt-6">
              Go to orders
            </Link>
          </section>
        ) : (
          <div className="card">
            <PanelError error={query.error} onRetry={() => void query.refetch()} />
          </div>
        )}
      </div>
    );
  }

  const data = query.data;
  const { order } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-3">
        <BackLink />
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-medium">
              {order.orderNumber}
              <Badge tone={orderStatusTone(order.status)}>{data.statusLabel}</Badge>
            </h1>
            <p className="mt-1 text-sm text-muted">
              Placed {formatDateTime(order.createdAt)} · {CHANNEL_LABELS[order.source?.channel ?? 'website']}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Total (cash on delivery)</p>
            <p className="text-2xl font-medium tabular-nums">{formatRs(order.pricing.total)}</p>
          </div>
        </header>
      </div>

      <OrderActions order={order} />
      <OrderAlerts data={data} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <OrderItemsCard order={order} />
          <OrderTimeline order={order} />
        </div>
        <div className="space-y-6">
          <CustomerCard data={data} />
          <NotesCard order={order} />
          <DeliveryCard order={order} />
          <OrderInfoCard data={data} />
        </div>
      </div>
    </div>
  );
}