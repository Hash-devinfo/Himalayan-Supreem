import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { ApiError } from '../../../api/client';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Skeleton from '../../../components/ui/Skeleton';
import { PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import PromotionForm from '../../../features/admin/promotions/PromotionForm';
import PromotionStatusBar from '../../../features/admin/promotions/PromotionStatusBar';
import { stateLabel, stateTone, TYPE_LABELS } from '../../../features/admin/promotions/promotionText';
import { usePromotion } from '../../../features/admin/promotions/queries';
import { formatCount, formatRs } from '../../../lib/format';

function BackLink() {
  return (
    <Link to="/admin/promotions" className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All promotions
    </Link>
  );
}

// /admin/promotions/new and /admin/promotions/:promotionId
export default function PromotionFormPage() {
  const { promotionId } = useParams();
  const navigate = useNavigate();
  const query = usePromotion(promotionId);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  if (!promotionId) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <BackLink />
        <h1 className="text-2xl font-medium">New promotion</h1>
        <PromotionForm onSaved={(promo) => navigate(`/admin/promotions/${promo.id}`, { replace: true })} />
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <div className="card">
          {notFound ? (
            <p className="p-6 text-center text-sm text-muted">This promotion doesn't exist.</p>
          ) : (
            <PanelError error={query.error} onRetry={() => void query.refetch()} />
          )}
        </div>
      </div>
    );
  }

  const { promotion, usage } = query.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink />
      <header>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-medium">
          {promotion.name}
          <Badge tone={stateTone(promotion)}>{stateLabel(promotion.state)}</Badge>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {TYPE_LABELS[promotion.type]}
          {promotion.code ? ` · code ${promotion.code}` : ''}
        </p>
      </header>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      <PromotionStatusBar promotion={promotion} onDone={setNotice} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <dt className="text-xs text-muted">Orders that used it</dt>
          <dd className="mt-1 text-2xl font-medium tabular-nums">{formatCount(usage.orders)}</dd>
        </div>
        <div className="card p-4">
          <dt className="text-xs text-muted">Discount given</dt>
          <dd className="mt-1 text-2xl font-medium tabular-nums">{formatRs(usage.discountGiven)}</dd>
        </div>
        {promotion.usageLimit !== undefined && (
          <div className="card p-4">
            <dt className="text-xs text-muted">Uses left</dt>
            <dd className="mt-1 text-2xl font-medium tabular-nums">
              {formatCount(Math.max(0, promotion.usageLimit - promotion.usageCount))}
            </dd>
          </div>
        )}
      </dl>

      {/* Keyed so the form starts fresh after each save or status change */}
      <PromotionForm
        key={JSON.stringify(promotion)}
        promotion={promotion}
        onSaved={(_promo, message) => setNotice(message)}
      />
    </div>
  );
}