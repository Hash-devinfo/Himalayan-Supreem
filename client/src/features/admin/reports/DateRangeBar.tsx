import { useState } from 'react';
import { Download } from 'lucide-react';
import { pktDateString } from '../../../lib/format';
import { presets, type DateRange } from './reportUtils';

interface DateRangeBarProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  csvUrl: string;
  note?: string; // e.g. "Stock levels are always as of now"
}

export default function DateRangeBar({ range, onChange, csvUrl, note }: DateRangeBarProps) {
  const [error, setError] = useState<string | null>(null);
  const options = presets();
  const today = pktDateString();

  function setCustom(from: string, to: string) {
    if (!from || !to) return;
    if (from > to) return setError('The start date must be on or before the end date');
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 >= 366) return setError('Choose a range of at most one year');
    setError(null);
    onChange({ from, to });
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
        {options.map((p) => {
          const active = p.range.from === range.from && p.range.to === range.to;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setError(null);
                onChange(p.range);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="report-from" className="block text-xs text-muted">
            From
          </label>
          <input
            id="report-from"
            type="date"
            max={today}
            value={range.from}
            onChange={(e) => setCustom(e.target.value, range.to)}
            className="input-field mt-1 w-auto py-2"
          />
        </div>
        <div>
          <label htmlFor="report-to" className="block text-xs text-muted">
            To
          </label>
          <input
            id="report-to"
            type="date"
            max={today}
            value={range.to}
            onChange={(e) => setCustom(range.from, e.target.value)}
            className="input-field mt-1 w-auto py-2"
          />
        </div>
        <a href={csvUrl} download className="btn-secondary ml-auto gap-2 px-4 py-2 text-sm">
          <Download className="h-4 w-4" aria-hidden="true" />
          Download CSV
        </a>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}
