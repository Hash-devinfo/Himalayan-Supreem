import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import Skeleton from '../../../../components/ui/Skeleton';
import { formatCount } from '../../../../lib/format';
import { STATUS_GROUPS } from '../chartTheme';
import { EmptyState, Panel, PanelError, PanelLink } from '../DashboardPanel';
import { useStatusMix } from '../queries';

function percent(count: number, total: number): string {
  if (!total || !count) return '0%';
  const value = Math.round((count / total) * 100);
  return value === 0 ? '<1%' : `${value}%`;
}

export default function OrderStatusMix() {
  const query = useStatusMix();
  const [highlight, setHighlight] = useState<string | null>(null);
  const action = <PanelLink to="/admin/orders">Orders</PanelLink>;

  if (query.isPending) {
    return (
      <Panel title="Where orders are now" subtitle="Orders placed in the last 30 days" action={action}>
        <div className="space-y-3 p-4">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Where orders are now" subtitle="Orders placed in the last 30 days" action={action}>
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      </Panel>
    );
  }

  const groups = STATUS_GROUPS.map((group) => ({
    ...group,
    count: query.data.ordersByStatus
      .filter((row) => group.statuses.includes(row.status))
      .reduce((sum, row) => sum + row.count, 0),
  }));
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <Panel title="Where orders are now" subtitle="Orders placed in the last 30 days" action={action}>
      {total === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders in the last 30 days" text="This fills in as orders come in." />
      ) : (
        <div className="p-4">
          <p className="text-2xl font-medium tabular-nums">
            {formatCount(total)} <span className="text-sm font-normal text-muted">orders placed</span>
          </p>

          {/* One bar split into parts; 2px white gaps between them */}
          <div
            className="mt-3 flex h-6 w-full gap-0.5 overflow-hidden rounded-md"
            role="img"
            aria-label={groups
              .filter((g) => g.count > 0)
              .map((g) => `${g.label}: ${g.count} (${percent(g.count, total)})`)
              .join(', ')}
          >
            {groups
              .filter((group) => group.count > 0)
              .map((group) => (
                <div
                  key={group.key}
                  title={`${group.label}: ${formatCount(group.count)} (${percent(group.count, total)})`}
                  className={`h-full min-w-[4px] transition-opacity duration-200 ${
                    highlight && highlight !== group.key ? 'opacity-25' : 'opacity-100'
                  }`}
                  style={{ width: `${(group.count / total) * 100}%`, backgroundColor: group.color }}
                />
              ))}
          </div>

          <ul className="mt-4 space-y-1">
            {groups.map((group) => (
              <li
                key={group.key}
                tabIndex={0}
                onMouseEnter={() => setHighlight(group.key)}
                onMouseLeave={() => setHighlight(null)}
                onFocus={() => setHighlight(group.key)}
                onBlur={() => setHighlight(null)}
                className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-canvas focus-visible:bg-canvas ${
                  group.count === 0 ? 'text-muted' : ''
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} aria-hidden="true" />
                <span className="flex-1 truncate">{group.label}</span>
                <span className="font-medium tabular-nums">{formatCount(group.count)}</span>
                <span className="w-10 text-right text-xs tabular-nums text-muted">{percent(group.count, total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}