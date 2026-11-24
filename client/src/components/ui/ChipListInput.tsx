import { useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';

interface ChipListInputProps {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number; // most items allowed
  maxLength: number; // most characters per item
  placeholder?: string;
  lowercase?: boolean;
  describedBy?: string;
}

// Type, press Enter (or Add): it becomes a chip. Each chip has a remove button.
export default function ChipListInput({
  id,
  values,
  onChange,
  max,
  maxLength,
  placeholder,
  lowercase = false,
  describedBy,
}: ChipListInputProps) {
  const [draft, setDraft] = useState('');
  const full = values.length >= max;

  function add() {
    const value = (lowercase ? draft.toLowerCase() : draft).trim();
    if (!value || full) return;
    if (!values.includes(value)) onChange([...values, value]);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || (e.key === ',' && lowercase)) {
      e.preventDefault();
      add();
    }
    if (e.key === 'Backspace' && !draft && values.length > 0) onChange(values.slice(0, -1));
  }

  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-sage-soft py-1 pl-3 pr-1 text-sm">
              <span className="truncate">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="rounded-full p-0.5 text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={full}
          placeholder={full ? `Up to ${max} only` : placeholder}
          aria-describedby={describedBy}
          className="input-field mt-0"
        />
        <button type="button" onClick={add} disabled={full || !draft.trim()} className="btn-secondary shrink-0 gap-1 px-4">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </div>
    </div>
  );
}