import { Star } from 'lucide-react';

export default function Stars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= rating ? 'fill-current text-warning' : 'text-line'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}