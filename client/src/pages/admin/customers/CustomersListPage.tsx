import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Ban, BadgeCheck, Search, Users } from 'lucide-react';
import { phoneForUrl, type CustomerFilter } from '../../../api/customers';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Pagination from '../../../components/ui/Pagination';
import { BlockDialog } from '../../../features/admin/customers/BlockDialogs';
import { useCustomerList } from '../../../features/admin/customers/queries';
import { EmptyState, ListSkeleton, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { timeAgo } from '../../../lib/format';
import type { RiskLevel } from '../../../api/orders';

const FILTERS: { value?: CustomerFilter; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'highRisk', label: 'High risk' },
  { value: 'blocked', label: 'Blocked' },
];

export function RiskBadge({ level }: { level: RiskLevel }) {
  if (level === 'blocked') return <Badge tone="danger">Blocked</Badge>;
  if (level === 'high') return <Badge tone="danger">High risk</Badge>;
  return null;
}

export default function CustomersListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.value === params.get('filter'))?.value;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const search = useDebouncedValue(searchText.trim(), 400);
  const [blocking, setBlocking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

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

  const customers = useCustomerList({ search: search || undefined, filter, page, limit: 20 });
  const open = (phone: string) => navigate(`/admin/customers/${phoneForUrl(phone)}`);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Customers</h1>
          <p className="mt-1 text-sm text-muted">Every phone number that has ordered, with its delivery history.</p>
        </div>
        <button type="button" onClick={() => setBlocking(true)} className="btn-secondary gap-2 text-danger">
          <Ban className="h-4 w-4" aria-hidden="true" />
          Block a number
        </button>
      </header>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter customers">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => updateParams({ filter: f.value })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                filter === f.value ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <label htmlFor="customer-search" className="sr-only">
            Search customers
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="customer-search"
            type="search"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              if (page !== 1) updateParams({});
            }}
            placeholder="Name or phone number"
            className="input-field mt-0 pl-10"
          />
        </div>
      </div>

      <section className="card overflow-hidden" aria-label="Customers">
        {customers.isPending ? (
          <ListSkeleton rows={5} />
        ) : customers.isError ? (
          <PanelError error={customers.error} onRetry={() => void customers.refetch()} />
        ) : customers.data.customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filter || search ? 'No customers match' : 'No customers yet'}
            text={filter || search ? 'Try another name or number.' : 'Customers appear here after their first order.'}
          />
        ) : (
          <div className={customers.isPlaceholderData ? 'opacity-60' : ''}>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Orders</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Delivered</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Refused</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Risk</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.data.customers.map((c) => (
                  <tr key={c.id} onClick={() => open(c.phone)} className="cursor-pointer transition-colors hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/customers/${phoneForUrl(c.phone)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        {c.phone}
                        {c.phoneVerified && <BadgeCheck className="h-3.5 w-3.5 text-sage" aria-label="Verified by call" />}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.risk.orders}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.risk.delivered}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${c.risk.refused > 0 ? 'font-medium text-danger' : ''}`}>
                      {c.risk.refused}
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={c.risk.level} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted">{c.lastOrderAt ? timeAgo(c.lastOrderAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {customers.data.customers.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/customers/${phoneForUrl(c.phone)}`} className="block px-4 py-3 transition-colors hover:bg-canvas">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {c.phone} · {c.risk.orders} orders · {c.risk.refused} refused
                        </p>
                      </div>
                      <RiskBadge level={c.risk.level} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {customers.data && customers.data.total > 0 && (
        <Pagination
          page={page}
          pages={customers.data.pages}
          total={customers.data.total}
          noun={customers.data.total === 1 ? 'customer' : 'customers'}
          onPage={(next) => {
            updateParams({ page: String(next) }, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <BlockDialog
        open={blocking}
        onClose={() => setBlocking(false)}
        onDone={(message) => {
          setBlocking(false);
          setNotice(message);
        }}
      />
    </div>
  );
}