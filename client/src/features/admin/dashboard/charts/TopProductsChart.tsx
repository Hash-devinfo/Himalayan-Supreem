import { Package } from 'lucide-react';
import { formatCount, formatRs } from '../../../../lib/format';
import { EmptyState, ListSkeleton, Panel, PanelError, PanelLink } from '../DashboardPanel';
import { useTopProducts } from '../queries';

const SHOW = 5;

export default function TopProductsChart() {
  const query = useTopProducts();
  const action = <PanelLink to="/admin/reports">Reports</PanelLink>;

  return (
    <Panel title="Top products" subtitle="Net sales, last 30 days" action={action}>
      {query.isPending ? (
        <ListSkeleton rows={4} />
      ) : query.isError ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products sold yet"
          text="Products appear here once their orders are delivered."
        />
      ) : (
        <ul className="space-y-4 px-4 py-4">
          {query.data.rows.slice(0, SHOW).map((row) => {
            const max = query.data.rows[0].sales || 1;
            const width = Math.max(2, (row.sales / max) * 100);
            return (
              <li key={row.productId}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{row.label}</span>
                  <span className="shrink-0 font-medium tabular-nums">{formatRs(row.sales)}</span>
                </div>
                <div className="mt-1.5 h-2.5" aria-hidden="true">
                  <div
                    className="h-full rounded-r-[4px] bg-sage transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {formatCount(row.qty)} sold · {formatCount(row.orders)} {row.orders === 1 ? 'order' : 'orders'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}