import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Bell, FileText, Truck } from 'lucide-react';
import Skeleton from '../../../components/ui/Skeleton';
import { Panel, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { useSettings } from '../../../features/admin/settings/queries';
import {
  OrdersDeliveryForm,
  RiskRulesForm,
  StockRulesForm,
  StoreDetailsForm,
} from '../../../features/admin/settings/SettingsForms';

type SectionName = 'store' | 'orders' | 'stock' | 'risk';

const MORE = [
  { to: '/admin/delivery', icon: Truck, label: 'Delivery', text: 'Zones, cities and delivery charges' },
  { to: '/admin/notifications', icon: Bell, label: 'Notifications', text: 'Email and WhatsApp message templates' },
  { to: '/admin/pages', icon: FileText, label: 'Policy pages', text: 'Refund, privacy, delivery and terms' },
];

export default function SettingsPage() {
  const query = useSettings();
  const [saved, setSaved] = useState<{ section: SectionName; message: string } | null>(null);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(null), 6000);
    return () => window.clearTimeout(id);
  }, [saved]);

  const onSaved = (section: SectionName) => (message: string) => setSaved({ section, message });
  const noticeFor = (section: SectionName) => (saved?.section === section ? saved.message : null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium">Settings</h1>
        <p className="mt-1 text-sm text-muted">Each section saves on its own. Every change is recorded in the audit log.</p>
      </header>

      {query.isPending ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="card">
          <PanelError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : (
        <>
          {/* key: a section restarts from the saved values only when its own values change,
              so saving one section never wipes unsaved edits in another */}
          <StoreDetailsForm
            key={JSON.stringify(query.data.settings.store)}
            settings={query.data.settings}
            savedNotice={noticeFor('store')}
            onSaved={onSaved('store')}
          />
          <OrdersDeliveryForm
            key={JSON.stringify([
              query.data.settings.orderPrefix,
              query.data.settings.freeDeliveryThreshold,
              query.data.settings.defaultPackagingCost,
            ])}
            settings={query.data.settings}
            savedNotice={noticeFor('orders')}
            onSaved={onSaved('orders')}
          />
          <StockRulesForm
            key={JSON.stringify(query.data.settings.inventory)}
            settings={query.data.settings}
            savedNotice={noticeFor('stock')}
            onSaved={onSaved('stock')}
          />
          <RiskRulesForm
            key={JSON.stringify(query.data.settings.risk)}
            settings={query.data.settings}
            savedNotice={noticeFor('risk')}
            onSaved={onSaved('risk')}
          />
        </>
      )}

      <Panel title="More settings">
        <ul className="divide-y divide-line">
          {MORE.map(({ to, icon: Icon, label, text }) => (
            <li key={to}>
              <Link to={to} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas">
                <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{text}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}