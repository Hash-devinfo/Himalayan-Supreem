import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Search, Undo2 } from 'lucide-react';
import type { RefundStatus } from '../../../api/refunds';
import Badge from '../../../components/ui/Badge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ListSkeleton, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { useRefundList } from '../../../features/admin/refunds/queries';
import { REFUND_REASON_LABELS, REFUND_STATUS_LABELS, REFUND_STATUS_TONES } from '../../../features/admin/refunds/refundLabels';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatDate, formatRs } from '../../../lib/format';

const FILTERS: { value?: RefundStatus; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'requested', label: 'To review' },
  { value: 'approved', label: 'To pay' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

export default function RefundsListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = FILTERS.find((f) => f.value === params.get('status'))?.value;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [searchText, setSearchText] = useState(params.get('order') ?? '');
  const order = useDebouncedValue(searchText.trim(), 400);

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

  const refunds = useRefundList({ status, order: order || undefined, page, limit: 20 });
  const filtered = Boolean(status || order);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-medium">Refunds</h1>
        <p className="mt-1 text-sm text-muted">
          Refunds for damaged or incorrect products. Record a new one from the delivered order's screen.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter refunds">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => updateParams({ status: f.value })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                status === f.value ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <label htmlFor="refund-search" className="sr-only">
            Search by order number
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="refund-search"
            type="search"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              if (page !== 1) updateParams({});
            }}
            placeholder="Full order number"
            className="input-field mt-0 pl-10"
          />
        </div>
      </div>

      <section className="card overflow-hidden" aria-label="Refunds">
        {refunds.isPending ? (
          <ListSkeleton rows={5} />
        ) : refunds.isError ? (
          <PanelError error={refunds.error} onRetry={() => void refunds.refetch()} />
        ) : refunds.data.refunds.length === 0 ? (
          <EmptyState
            icon={Undo2}
            title={filtered ? 'No refunds match' : 'No refunds yet'}
            text={filtered ? 'Try another filter, or type the full order number.' : 'Refunds you record on delivered orders appear here.'}
          />
        ) : (
          <div className={refunds.isPlaceholderData ? 'opacity-60' : ''}>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Order</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Reason</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Recorded</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {refunds.data.refunds.map((r) => (
                  <tr key={r._id} onClick={() => navigate(`/admin/refunds/${r._id}`)} className="cursor-pointer transition-colors hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/refunds/${r._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {r.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{REFUND_REASON_LABELS[r.reason]}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatRs(r.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={REFUND_STATUS_TONES[r.status]}>{REFUND_STATUS_LABELS[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted">
                      {r.paidAt ? `${formatDate(r.paidAt)}${r.payoutMethod ? ` · ${r.payoutMethod}` : ''}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {refunds.data.refunds.map((r) => (
                <li key={r._id}>
                  <Link to={`/admin/refunds/${r._id}`} className="block px-4 py-3 transition-colors hover:bg-canvas">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.orderNumber}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {REFUND_REASON_LABELS[r.reason]} · {formatDate(r.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-medium tabular-nums">{formatRs(r.amount)}</span>
                        <Badge tone={REFUND_STATUS_TONES[r.status]}>{REFUND_STATUS_LABELS[r.status]}</Badge>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {refunds.data && refunds.data.total > 0 && (
        <Pagination
          page={page}
          pages={refunds.data.pages}
          total={refunds.data.total}
          noun={refunds.data.total === 1 ? 'refund' : 'refunds'}
          onPage={(next) => {
            updateParams({ page: String(next) }, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}