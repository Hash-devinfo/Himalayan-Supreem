import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, Star, X } from 'lucide-react';
import type { ReviewStatus } from '../../../api/reviews';
import FormAlert from '../../../components/ui/FormAlert';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ListSkeleton, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { useReviewList } from '../../../features/admin/reviews/queries';
import ReviewCard from '../../../features/admin/reviews/ReviewCard';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatCount } from '../../../lib/format';

const TABS: { value: ReviewStatus; label: string; empty: string }[] = [
  { value: 'pending', label: 'Pending', empty: 'Nothing to check. New reviews appear here before they go on the website.' },
  { value: 'published', label: 'Published', empty: 'No published reviews yet.' },
  { value: 'hidden', label: 'Hidden', empty: 'No hidden reviews.' },
  { value: 'removed', label: 'Removed', empty: 'No removed reviews.' },
];

export default function ReviewsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.value === params.get('status')) ?? TABS[0];
  const page = Math.max(1, Number(params.get('page')) || 1);
  const ratingParam = Number(params.get('rating'));
  const rating = ratingParam >= 1 && ratingParam <= 5 ? ratingParam : undefined;
  const product = params.get('product') ?? undefined; // set by links from a product
  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const search = useDebouncedValue(searchText.trim(), 400);
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

  const reviews = useReviewList({ status: tab.value, rating, product, search: search || undefined, page, limit: 20 });
  const counts = reviews.data?.counts;
  const filtered = Boolean(rating || product || search);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-medium">Reviews</h1>
        <p className="mt-1 text-sm text-muted">
          Only customers whose order was delivered can review. Reviews appear on the website after you publish them.
        </p>
      </header>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Review status">
        {TABS.map((t) => {
          const active = t.value === tab.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => updateParams({ status: t.value === 'pending' ? undefined : t.value })}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${
                active ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
              {counts && <span className="ml-1.5 tabular-nums text-muted">({formatCount(counts[t.value])})</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <label htmlFor="review-search" className="sr-only">
            Search reviews
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="review-search"
            type="search"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              if (page !== 1) updateParams({});
            }}
            placeholder="Order number or customer name"
            className="input-field mt-0 pl-10"
          />
        </div>
        <label htmlFor="review-rating" className="sr-only">
          Star rating
        </label>
        <select
          id="review-rating"
          value={rating ?? ''}
          onChange={(e) => updateParams({ rating: e.target.value || undefined })}
          className="input-field mt-0 w-auto"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'star' : 'stars'}
            </option>
          ))}
        </select>
        {product && (
          <button
            type="button"
            onClick={() => updateParams({ product: undefined })}
            className="inline-flex items-center gap-1 rounded-full border border-ink px-3 py-1.5 text-sm"
          >
            One product only
            <X className="h-3.5 w-3.5" aria-label="Show all products" />
          </button>
        )}
      </div>

      {reviews.isPending ? (
        <div className="card">
          <ListSkeleton rows={4} />
        </div>
      ) : reviews.isError ? (
        <div className="card">
          <PanelError error={reviews.error} onRetry={() => void reviews.refetch()} />
        </div>
      ) : reviews.data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Star} title={filtered ? 'No reviews match' : 'No reviews here'} text={filtered ? 'Try another search or rating.' : tab.empty} />
        </div>
      ) : (
        <div className={`space-y-3 ${reviews.isPlaceholderData ? 'opacity-60' : ''}`}>
          {reviews.data.items.map((review) => (
            <ReviewCard key={review.id} review={review} onDone={setNotice} />
          ))}
        </div>
      )}

      {reviews.data && reviews.data.total > 0 && (
        <Pagination
          page={page}
          pages={reviews.data.totalPages}
          total={reviews.data.total}
          noun={reviews.data.total === 1 ? 'review' : 'reviews'}
          onPage={(next) => {
            updateParams({ page: String(next) }, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}