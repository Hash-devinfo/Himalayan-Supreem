import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartLine } from 'lucide-react';
import type { SalesDayRow } from '../../../../api/reports';
import Skeleton from '../../../../components/ui/Skeleton';
import { formatCount, formatDay, formatRs } from '../../../../lib/format';
import { CHART, prefersReducedMotion } from '../chartTheme';
import { EmptyState, Panel, PanelError } from '../DashboardPanel';
import { useSalesStats } from '../queries';

interface DayPoint {
  date: string;
  label: string;
  sales: number;
  orders: number;
}

const DAY_MS = 86_400_000;

// The server only sends days that had deliveries; fill the rest with 0 so gaps are visible
function fillDays(from: string, to: string, rows: SalesDayRow[]): DayPoint[] {
  const byDay = new Map(rows.map((row) => [row.key, row]));
  const points: DayPoint[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const row = byDay.get(date);
    points.push({ date, label: formatDay(date), sales: row?.sales ?? 0, orders: row?.orders ?? 0 });
  }
  return points;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const compactRs = (value: number) => (value === 0 ? '0' : `Rs ${compact.format(value)}`);

function SalesTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: DayPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.label}</p>
      <p className="mt-1 tabular-nums">{formatRs(point.sales)} net sales</p>
      <p className="tabular-nums text-muted">
        {formatCount(point.orders)} delivered {point.orders === 1 ? 'order' : 'orders'}
      </p>
    </div>
  );
}

export default function SalesTrendChart() {
  const query = useSalesStats();

  if (query.isPending) {
    return (
      <Panel title="Net sales per day" subtitle="Last 30 days">
        <div className="p-4">
          <Skeleton className="h-56 w-full" />
        </div>
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Net sales per day" subtitle="Last 30 days">
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      </Panel>
    );
  }

  const { range, summary, daily } = query.data;
  const points = fillDays(range.from, range.to, daily);
  const best = points.reduce((top, point) => (point.sales > top.sales ? point : top), points[0]);

  return (
    <Panel
      title="Net sales per day"
      subtitle={`${formatRs(summary.netSales)} in the last 30 days · counted on the day of delivery`}
    >
      {summary.netSales === 0 ? (
        <EmptyState
          icon={ChartLine}
          title="No sales in the last 30 days"
          text="A sale is counted when its order is marked Delivered."
        />
      ) : (
        <>
          <div
            className="h-56 px-2 pt-4"
            role="img"
            aria-label={`Line chart of net sales per day from ${formatDay(range.from)} to ${formatDay(range.to)}. Total ${formatRs(summary.netSales)}. Best day ${best.label} with ${formatRs(best.sales)}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  tick={{ fill: CHART.axisText, fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={compactRs}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: CHART.axisText, fontSize: 11 }}
                  width={60}
                  allowDecimals={false}
                />
                <Tooltip content={<SalesTooltip />} cursor={{ stroke: CHART.axisText, strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={CHART.line}
                  strokeWidth={2}
                  fill={CHART.line}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, fill: CHART.line, stroke: CHART.surface, strokeWidth: 2 }}
                  isAnimationActive={!prefersReducedMotion}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 pt-2 text-xs text-muted">
            <span>
              Best day: <span className="font-medium text-ink">{best.label}</span> · {formatRs(best.sales)}
            </span>
            <details className="w-full sm:w-auto">
              <summary className="cursor-pointer text-sage underline-offset-4 hover:underline">Show as table</summary>
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-canvas text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-1.5 font-medium">Day</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-medium">Orders</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-medium">Net sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {points.map((p) => (
                      <tr key={p.date}>
                        <td className="px-3 py-1.5">{p.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(p.orders)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatRs(p.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </>
      )}
    </Panel>
  );
}