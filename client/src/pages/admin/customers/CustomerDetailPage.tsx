import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Ban, BadgeCheck, MessageCircle, Phone, ShoppingBag } from 'lucide-react';
import { phoneForUrl } from '../../../api/customers';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Skeleton from '../../../components/ui/Skeleton';
import { BlockDialog, UnblockDialog } from '../../../features/admin/customers/BlockDialogs';
import { useCustomer } from '../../../features/admin/customers/queries';
import { EmptyState, Panel, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { PAYMENT_STATUS_LABELS } from '../../../features/admin/orders/orderLabels';
import { formatDateTime, formatIsoDay, formatRs } from '../../../lib/format';
import { RiskBadge } from './CustomersListPage';

// 0300 1234567 -> 923001234567 (what wa.me expects)
function whatsappDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
}

export default function CustomerDetailPage() {
  const { phone: phoneParam = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useCustomer(phoneParam);
  const [dialog, setDialog] = useState<'block' | 'unblock' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const back = (
    <button
      type="button"
      onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/admin/customers'))}
      className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </button>
  );

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {back}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {back}
        <div className="card">
          <PanelError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      </div>
    );
  }

  const { phone, customer, risk, recentOrders } = query.data;
  const blocked = customer?.isBlocked ?? false;
  const tiles = [
    { label: 'Orders', value: risk.orders, bad: false },
    { label: 'Delivered', value: risk.delivered, bad: false },
    { label: 'Refused or not collected', value: risk.refused, bad: risk.refused > 0 },
    { label: 'Cancelled', value: risk.cancelled, bad: false },
  ];
  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        {back}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-medium">
              {customer?.name ?? 'Unknown number'}
              <RiskBadge level={risk.level} />
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="tabular-nums">{phone}</span>
              {customer?.phoneVerified && (
                <span className="inline-flex items-center gap-1 text-sage">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  Verified by call
                </span>
              )}
              {customer?.email && (
                <a href={`mailto:${customer.email}`} className="break-all text-sage underline-offset-4 hover:underline">
                  {customer.email}
                </a>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="btn-primary gap-2">
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
            <a href={`https://wa.me/${whatsappDigits(phone)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary gap-2">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
          </div>
        </header>
      </div>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      {blocked && customer ? (
        <div className="rounded-2xl border border-danger/30 bg-danger-soft p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <Ban className="h-4 w-4" aria-hidden="true" />
            This number is blocked
          </p>
          <p className="mt-1 text-sm text-danger">
            {customer.blockedReason ?? 'No reason recorded.'}
            {customer.blockedAt ? ` · ${formatDateTime(customer.blockedAt)}` : ''}
            {customer.blockedBy ? ` · by ${customer.blockedBy}` : ''}
          </p>
          <button type="button" onClick={() => setDialog('unblock')} className="btn-secondary mt-3 px-4 py-2">
            Unblock
          </button>
        </div>
      ) : (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">
            {risk.level === 'high'
              ? 'High risk: this number has refused or not collected parcels before. Block it if orders keep failing.'
              : 'Block this number to stop new orders from it.'}
          </p>
          <button type="button" onClick={() => setDialog('block')} className="btn-secondary gap-2 text-danger">
            <Ban className="h-4 w-4" aria-hidden="true" />
            Block number
          </button>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-4">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className={`mt-1 text-2xl font-medium tabular-nums ${tile.bad ? 'text-danger' : ''}`}>{tile.value}</dd>
          </div>
        ))}
      </dl>

      <Panel
        title="Recent orders"
        subtitle="The last 20, newest first"
        action={
          risk.orders > 0 ? (
            <Link to={`/admin/orders?search=${phoneForUrl(phone)}`} className="shrink-0 text-xs text-sage underline-offset-4 hover:underline">
              See all orders
            </Link>
          ) : undefined
        }
      >
        {recentOrders.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No orders from this number" text="It was blocked before ordering, or has never ordered." />
        ) : (
          <ul className="divide-y divide-line">
            {recentOrders.map((o) => (
              <li key={o.orderNumber}>
                <Link to={`/admin/orders/${o.orderNumber}`} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-canvas">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{o.orderNumber}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {formatIsoDay(o.placedOn)} · {o.city} · {PAYMENT_STATUS_LABELS[o.payment]}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular-nums">{formatRs(o.total)}</span>
                    <Badge tone={o.payment === 'refused' || o.payment === 'uncollected' ? 'danger' : 'neutral'}>{o.status}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <BlockDialog open={dialog === 'block'} phone={phone} onClose={() => setDialog(null)} onDone={(message) => done(message)} />
      <UnblockDialog open={dialog === 'unblock'} phone={phone} onClose={() => setDialog(null)} onDone={done} />
    </div>
  );
}