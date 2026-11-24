import { useState } from 'react';
import { History } from 'lucide-react';
import type { MovementsQuery } from '../../../api/inventory';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ListSkeleton, Panel, PanelError } from '../dashboard/DashboardPanel';
import { formatDateTime } from '../../../lib/format';
import { MOVEMENT_IN, MOVEMENT_LABELS } from './batchStatus';
import { useMovements } from './queries';

interface MovementsTableProps {
  filter: Omit<MovementsQuery, 'page' | 'limit'>;
  showProduct?: boolean; // the store-wide log shows which product
  title?: string;
}

export default function MovementsTable({ filter, showProduct = false, title = 'Stock movements' }: MovementsTableProps) {
  const [page, setPage] = useState(1);
  const query = useMovements({ ...filter, page, limit: 20 });

  return (
    <div className="space-y-3">
      <Panel title={title} subtitle="Every stock change, newest first">
        {query.isPending ? (
          <ListSkeleton rows={4} />
        ) : query.isError ? (
          <PanelError error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState icon={History} title="No stock movements yet" text="Receiving a batch is the first one." />
        ) : (
          <ul className={`divide-y divide-line transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
            {query.data.items.map((m) => {
              const adds = MOVEMENT_IN.has(m.type);
              return (
                <li key={m._id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{MOVEMENT_LABELS[m.type]}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(m.createdAt)}
                      {showProduct && m.product ? ` · ${m.product.name}${m.variant ? ` (${m.variant.label})` : ''}` : ''}
                      {m.batch ? ` · batch ${m.batch.batchNumber}` : ''}
                      {m.order ? ' · for an order' : ''}
                      {m.admin ? ` · ${m.admin.name}` : ''}
                    </p>
                    {m.reason && <p className="mt-1 text-xs">{m.reason}</p>}
                  </div>
                  <span className={`shrink-0 font-medium tabular-nums ${adds ? 'text-sage' : 'text-danger'}`}>
                    {adds ? '+' : '−'}
                    {m.quantity}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {query.data && query.data.totalPages > 1 && (
        <Pagination page={page} pages={query.data.totalPages} total={query.data.total} noun="movements" onPage={setPage} />
      )}
    </div>
  );
}