import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useCategories, useProductList } from '../products/queries';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

interface PickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

// Products: search, tick, and the chosen ones stay listed as chips
export function ProductPicker({ selected, onChange, invalid }: PickerProps) {
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedValue(searchText.trim(), 300);
  const results = useProductList({ search: search || undefined, limit: 100 });
  // Names for the chips (a small store has fewer than 100 products)
  const all = useProductList({ limit: 100 });
  const nameOf = (id: string) => all.data?.items.find((p) => p._id === id)?.name ?? 'Product';
  const options = (results.data?.items ?? []).filter((p) => p.status !== 'archived');

  return (
    <div className={`rounded-xl border ${invalid ? 'border-danger' : 'border-line'}`}>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-b border-line p-3" aria-label="Chosen products">
          {selected.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== id))}
                className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-3 py-1 text-xs text-ink hover:bg-danger-soft"
                aria-label={`Remove ${nameOf(id)}`}
              >
                {nameOf(id)}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative p-3">
        <label htmlFor="promo-product-search" className="sr-only">
          Search products
        </label>
        <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="promo-product-search"
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search products"
          className="input-field mt-0 pl-10"
        />
      </div>
      <ul className="max-h-56 overflow-y-auto border-t border-line">
        {results.isPending ? (
          <li className="px-4 py-3 text-sm text-muted">Loading…</li>
        ) : options.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No products match.</li>
        ) : (
          options.map((p) => (
            <li key={p._id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-canvas">
                <input
                  type="checkbox"
                  checked={selected.includes(p._id)}
                  onChange={() => onChange(toggleId(selected, p._id))}
                  className="accent-sage"
                />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.status !== 'published' && <span className="text-xs text-muted">Not on sale</span>}
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function CategoryPicker({ selected, onChange, invalid }: PickerProps) {
  const categories = useCategories();
  const options = (categories.data?.categories ?? []).filter((c) => c.status !== 'archived');

  return (
    <ul className={`divide-y divide-line rounded-xl border ${invalid ? 'border-danger' : 'border-line'}`}>
      {categories.isPending ? (
        <li className="px-4 py-3 text-sm text-muted">Loading…</li>
      ) : options.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">No categories yet.</li>
      ) : (
        options.map((c) => (
          <li key={c._id}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-canvas">
              <input
                type="checkbox"
                checked={selected.includes(c._id)}
                onChange={() => onChange(toggleId(selected, c._id))}
                className="accent-sage"
              />
              <span className="flex-1">{c.name}</span>
              {c.status === 'hidden' && <span className="text-xs text-muted">Hidden</span>}
            </label>
          </li>
        ))
      )}
    </ul>
  );
}