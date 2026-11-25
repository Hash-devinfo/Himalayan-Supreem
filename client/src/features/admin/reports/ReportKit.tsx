import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

// ── Summary tiles ────────────────────────────────────

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-xl font-medium tabular-nums ${tone === 'bad' ? 'text-danger' : tone === 'good' ? 'text-sage' : ''}`}>
        {value}
      </dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</dl>;
}

// ── Tables ───────────────────────────────────────────

export interface Column<T> {
  label: string;
  value: (row: T) => ReactNode;
  align?: 'right';
}

interface TableProps<T> {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty: string;
}

// Scrolls sideways on a phone instead of squashing the numbers
export function ReportTable<T>({ title, subtitle, columns, rows, rowKey, empty }: TableProps<T>) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-canvas text-left text-xs text-muted">
              <tr>
                {columns.map((c, ci) => (
                  <th
                    key={c.label}
                    scope="col"
                    className={`px-4 py-2.5 font-medium ${ci > 0 ? 'whitespace-nowrap' : ''} ${c.align === 'right' ? 'text-right' : ''}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={rowKey(row, i)}>
                  {columns.map((c, ci) => (
                    // The first column (names) wraps; numbers stay on one line
                    <td
                      key={c.label}
                      className={`px-4 py-2.5 ${ci === 0 ? 'min-w-44' : 'whitespace-nowrap'} ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {c.value(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Bars ─────────────────────────────────────────────

// A labelled horizontal bar per row: quick to compare, readable on a phone
export function BarList({ title, subtitle, rows, empty }: { title: string; subtitle?: string; rows: { label: string; value: number; display: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3 px-4 py-4">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums">{r.display}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-canvas">
                <div className="h-2 rounded-full bg-sage" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Notes ────────────────────────────────────────────

const human = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

// The server's own explanation of every number, folded away until needed
export function Definitions({ definitions }: { definitions?: Record<string, string> }) {
  if (!definitions) return null;
  return (
    <details className="card group px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
        <Info className="h-4 w-4 text-muted" aria-hidden="true" />
        How these numbers are worked out
      </summary>
      <dl className="mt-3 space-y-2">
        {Object.entries(definitions).map(([key, text]) => (
          <div key={key}>
            <dt className="text-xs font-medium">{human(key)}</dt>
            <dd className="text-xs text-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
