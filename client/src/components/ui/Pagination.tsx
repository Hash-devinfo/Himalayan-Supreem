import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCount } from '../../lib/format';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  noun: string; // e.g. "orders"
  onPage: (page: number) => void;
}

export default function Pagination({ page, pages, total, noun, onPage }: PaginationProps) {
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        {formatCount(total)} {noun}
        {pages > 1 && ` · page ${page} of ${pages}`}
      </p>
      {pages > 1 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="btn-secondary gap-1 px-3 py-1.5"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            className="btn-secondary gap-1 px-3 py-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}