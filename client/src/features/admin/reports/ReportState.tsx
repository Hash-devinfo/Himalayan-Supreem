import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import Skeleton from '../../../components/ui/Skeleton';
import { PanelError } from '../dashboard/DashboardPanel';

// Loading and error states shared by every report
export default function ReportState<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="card">
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  return <div className={`space-y-5 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>{children(query.data)}</div>;
}
