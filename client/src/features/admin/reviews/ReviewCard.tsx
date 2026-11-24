import { useState } from 'react';
import { Link } from 'react-router';
import { CircleCheck, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import type { AdminReview, ReviewStatus } from '../../../api/reviews';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import { formatIsoDay } from '../../../lib/format';
import ModerateDialog from './ModerateDialog';
import { useModerateReview } from './queries';
import Stars from './Stars';

const STATUS_BADGE: Record<ReviewStatus, { label: string; tone: 'warning' | 'success' | 'neutral' | 'danger' }> = {
  pending: { label: 'Pending', tone: 'warning' },
  published: { label: 'Published', tone: 'success' },
  hidden: { label: 'Hidden', tone: 'neutral' },
  removed: { label: 'Removed', tone: 'danger' },
};

interface ReviewCardProps {
  review: AdminReview;
  onDone: (message: string) => void;
}

export default function ReviewCard({ review, onDone }: ReviewCardProps) {
  const [dialog, setDialog] = useState<'hidden' | 'removed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publish = useModerateReview();
  const badge = STATUS_BADGE[review.status];

  function handlePublish() {
    setError(null);
    publish.mutate(
      { id: review.id, status: 'published' },
      {
        onSuccess: () => onDone(`${review.displayName}'s review is published on the website.`),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
      },
    );
  }

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            {review.status !== 'pending' && <Badge tone={badge.tone}>{badge.label}</Badge>}
          </div>
          {review.title && <h2 className="mt-2 font-medium">{review.title}</h2>}
        </div>
        <p className="text-xs text-muted">{formatIsoDay(review.date)}</p>
      </div>

      {review.body ? (
        <p className="mt-2 whitespace-pre-line text-sm">{review.body}</p>
      ) : (
        !review.title && <p className="mt-2 text-sm italic text-muted">Stars only, no written review.</p>
      )}

      <p className="mt-3 text-xs text-muted">
        <span className="font-medium text-ink">{review.displayName}</span>
        {' · '}
        {review.product ? (
          <Link to={`/admin/products/${review.product._id}`} className="text-sage underline-offset-4 hover:underline">
            {review.product.name}
          </Link>
        ) : (
          'Deleted product'
        )}
        {` (${review.variantLabel}) · order `}
        <Link to={`/admin/orders/${review.orderNumber}`} className="text-sage underline-offset-4 hover:underline">
          {review.orderNumber}
        </Link>
      </p>

      {review.moderationNote && (review.status === 'hidden' || review.status === 'removed') && (
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
          <span className="font-medium text-ink">Your note:</span> {review.moderationNote}
        </p>
      )}

      {error && (
        <FormAlert tone="danger" className="mt-3">
          {error}
        </FormAlert>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
        {review.status !== 'published' && (
          <button type="button" onClick={handlePublish} disabled={publish.isPending} className="btn-primary gap-2 px-4 py-2">
            {publish.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
            )}
            Publish
          </button>
        )}
        {review.status !== 'hidden' && (
          <button type="button" onClick={() => setDialog('hidden')} className="btn-secondary gap-2 px-4 py-2">
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Hide
          </button>
        )}
        {review.status !== 'removed' && (
          <button type="button" onClick={() => setDialog('removed')} className="btn-secondary gap-2 px-4 py-2 text-danger">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </button>
        )}
      </div>

      {dialog && (
        <ModerateDialog
          open
          review={review}
          action={dialog}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            onDone(message);
          }}
        />
      )}
    </article>
  );
}