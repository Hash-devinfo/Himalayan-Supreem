import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Plus, Search, TicketPercent } from 'lucide-react';
import type { PromotionStatus } from '../../../api/promotions';
import Badge from '../../../components/ui/Badge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ListSkeleton, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { discountText, stateLabel, stateTone, TYPE_LABELS } from '../../../features/admin/promotions/promotionText';
import { usePromotionList } from '../../../features/admin/promotions/queries';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatCount, formatIsoDay } from '../../../lib/format';

const FILTERS: { value?: PromotionStatus; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

const dates = (startsOn: string, endsOn: string | null) =>
  endsOn ? `${formatIsoDay(startsOn)} – ${formatIsoDay(endsOn)}` : `From ${formatIsoDay(startsOn)}`;

const uses = (count: number, limit?: number) => (limit ? `${formatCount(count)} / ${formatCount(limit)} uses` : `${formatCount(count)} uses`);

export default function PromotionsListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = FILTERS.find((f) => f.value === params.get('status'))?.value;
  const page = Math.max(1, Number(params.get('page')) || 1);
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

  const promotions = usePromotionList({ status, search: search || undefined, page, limit: 20 });
  const filtered = Boolean(status || search);
  const open = (id: string) => navigate(`/admin/promotions/${id}`);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Promotions</h1>
          <p className="mt-1 text-sm text-muted">Discount codes and automatic sales.</p>
        </div>
        <Link to="/admin/promotions/new" className="btn-primary gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New promotion
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter promotions">
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
          <label htmlFor="promo-search" className="sr-only">
            Search promotions
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="promo-search"
            type="search"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              if (page !== 1) updateParams({});
            }}
            placeholder="Name or code"
            className="input-field mt-0 pl-10"
          />
        </div>
      </div>

      <section className="card overflow-hidden" aria-label="Promotions">
        {promotions.isPending ? (
          <ListSkeleton rows={4} />
        ) : promotions.isError ? (
          <PanelError error={promotions.error} onRetry={() => void promotions.refetch()} />
        ) : promotions.data.items.length === 0 ? (
          <EmptyState
            icon={TicketPercent}
            title={filtered ? 'No promotions match' : 'No promotions yet'}
            text={filtered ? 'Try another filter or search.' : 'Create a discount code or a sale with New promotion.'}
          />
        ) : (
          <div className={promotions.isPlaceholderData ? 'opacity-60' : ''}>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Promotion</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Discount</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Dates</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Used</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {promotions.data.items.map((p) => (
                  <tr key={p.id} onClick={() => open(p.id)} className="cursor-pointer transition-colors hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/promotions/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {TYPE_LABELS[p.type]}
                        {p.code && <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-ink">{p.code}</code>}
                      </p>
                    </td>
                    <td className="px-4 py-3">{discountText(p)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{dates(p.startsOn, p.endsOn)}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-muted">{p.type === 'code' ? uses(p.usageCount, p.usageLimit) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={stateTone(p)}>{stateLabel(p.state)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {promotions.data.items.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/promotions/${p.id}`} className="block px-4 py-3 transition-colors hover:bg-canvas">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {p.code ? `${p.code} · ` : ''}
                          {discountText(p)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{dates(p.startsOn, p.endsOn)}</p>
                      </div>
                      <Badge tone={stateTone(p)}>{stateLabel(p.state)}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {promotions.data && promotions.data.total > 0 && (
        <Pagination
          page={page}
          pages={promotions.data.totalPages}
          total={promotions.data.total}
          noun={promotions.data.total === 1 ? 'promotion' : 'promotions'}
          onPage={(next) => {
            updateParams({ page: String(next) }, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}