import { Navigate, NavLink, useParams, useSearchParams } from 'react-router';
import { reportCsvUrl, type ReportName, type SalesGroup } from '../../../api/reports';
import DateRangeBar from '../../../features/admin/reports/DateRangeBar';
import { presets, SALES_GROUPS, type DateRange } from '../../../features/admin/reports/reportUtils';
import AnalyticsReportView from '../../../features/admin/reports/views/AnalyticsReportView';
import CancellationsReportView from '../../../features/admin/reports/views/CancellationsReportView';
import FulfillmentReportView from '../../../features/admin/reports/views/FulfillmentReportView';
import InventoryReportView from '../../../features/admin/reports/views/InventoryReportView';
import ProfitReportView from '../../../features/admin/reports/views/ProfitReportView';
import PromotionsReportView from '../../../features/admin/reports/views/PromotionsReportView';
import RiskReportView from '../../../features/admin/reports/views/RiskReportView';
import SalesReportView from '../../../features/admin/reports/views/SalesReportView';

const REPORTS: { name: ReportName; label: string; description: string }[] = [
  { name: 'sales', label: 'Sales', description: 'Delivered orders, discounts and refunds' },
  { name: 'profit', label: 'Profit', description: 'Sales minus product, packaging, courier and COD costs' },
  { name: 'inventory', label: 'Stock', description: 'Stock now, expiry and stock movements' },
  { name: 'fulfillment', label: 'Delivery', description: 'Courier performance, failed deliveries and COD' },
  { name: 'cancellations', label: 'Cancellations & refunds', description: 'Why orders were cancelled and refunds paid' },
  { name: 'promotions', label: 'Promotions', description: 'What each promotion brought in and cost' },
  { name: 'risk', label: 'Risk', description: 'Refused parcels and cancellations by city and number' },
  { name: 'analytics', label: 'Website', description: 'Visitors, searches, carts and traffic sources' },
];

const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

// /admin/reports/:report?from=YYYY-MM-DD&to=YYYY-MM-DD&group=product
export default function ReportsPage() {
  const { report = 'sales' } = useParams();
  const [params, setParams] = useSearchParams();
  const current = REPORTS.find((r) => r.name === report);

  const fallback = presets()[2]!.range; // last 30 days
  const from = params.get('from');
  const to = params.get('to');
  const range: DateRange = isDate(from) && isDate(to) ? { from, to } : fallback;
  const groupBy = (SALES_GROUPS.find((g) => g.value === params.get('group'))?.value ?? 'day') as SalesGroup;

  if (!current) return <Navigate to="/admin/reports/sales" replace />;

  // The date range stays the same when you switch reports
  const keep = `?from=${range.from}&to=${range.to}`;

  function setRange(next: DateRange) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('from', next.from);
      p.set('to', next.to);
      return p;
    });
  }

  const view = {
    sales: <SalesReportView range={range} groupBy={groupBy} />,
    profit: <ProfitReportView range={range} />,
    inventory: <InventoryReportView range={range} />,
    fulfillment: <FulfillmentReportView range={range} />,
    cancellations: <CancellationsReportView range={range} />,
    promotions: <PromotionsReportView range={range} />,
    risk: <RiskReportView range={range} />,
    analytics: <AnalyticsReportView range={range} />,
  }[current.name];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-medium">Reports</h1>
        <p className="mt-1 text-sm text-muted">{current.description}. Dates are Pakistan time.</p>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1" aria-label="Reports">
        {REPORTS.map((r) => (
          <NavLink
            key={r.name}
            to={`/admin/reports/${r.name}${keep}`}
            className={({ isActive }) =>
              `-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${
                isActive ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
              }`
            }
          >
            {r.label}
          </NavLink>
        ))}
      </nav>

      <DateRangeBar
        range={range}
        onChange={setRange}
        csvUrl={reportCsvUrl(current.name, { ...range, ...(current.name === 'sales' ? { groupBy } : {}) })}
        note={
          current.name === 'inventory'
            ? 'Stock levels and expiry are always as of now. The dates only change the stock movements.'
            : current.name === 'fulfillment'
              ? 'COD still with couriers is all time, as of now.'
              : undefined
        }
      />

      {current.name === 'sales' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Group sales">
          {SALES_GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              aria-pressed={groupBy === g.value}
              onClick={() =>
                setParams((prev) => {
                  const p = new URLSearchParams(prev);
                  if (g.value === 'day') p.delete('group');
                  else p.set('group', g.value);
                  return p;
                })
              }
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                groupBy === g.value ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {view}
    </div>
  );
}
