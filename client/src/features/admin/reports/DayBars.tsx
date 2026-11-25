import type { SalesDayRow } from '../../../api/reports';
import { formatDay, formatRs } from '../../../lib/format';

// Every day from "from" to "to", with 0 for days that had no deliveries
function allDays(from: string, to: string, rows: SalesDayRow[]) {
  const byDay = new Map(rows.map((r) => [r.key, r]));
  const days: { day: string; sales: number; orders: number }[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end && days.length < 400; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const row = byDay.get(day);
    days.push({ day, sales: row?.sales ?? 0, orders: row?.orders ?? 0 });
  }
  return days;
}

// Net sales per day as simple bars. The table below the chart has the exact numbers.
export default function DayBars({ from, to, rows }: { from: string; to: string; rows: SalesDayRow[] }) {
  const days = allDays(from, to, rows);
  const max = Math.max(1, ...days.map((d) => d.sales));
  const best = days.reduce((a, b) => (b.sales > a.sales ? b : a), days[0] ?? { day: from, sales: 0, orders: 0 });

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Sales per day</h2>
        {best.sales > 0 && (
          <p className="text-xs text-muted">
            Best day: {formatDay(best.day)} · {formatRs(best.sales)}
          </p>
        )}
      </div>
      <div className="mt-4 flex h-40 items-end gap-[2px]" role="img" aria-label="Sales per day bar chart; exact numbers in the table below">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${formatDay(d.day)}: ${formatRs(d.sales)} · ${d.orders} ${d.orders === 1 ? 'order' : 'orders'}`}
            className="group relative flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-[3px] transition-colors ${d.sales > 0 ? 'bg-sage group-hover:bg-ink' : 'bg-line'}`}
              style={{ height: d.sales > 0 ? `${Math.max(3, (d.sales / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{formatDay(from)}</span>
        <span>{formatDay(to)}</span>
      </div>
    </section>
  );
}
