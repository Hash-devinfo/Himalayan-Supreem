import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Boxes, PackagePlus } from 'lucide-react';
import type { BatchView } from '../../../api/inventory';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Skeleton from '../../../components/ui/Skeleton';
import { EmptyState, Panel, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import AdjustStockDialog from '../../../features/admin/inventory/AdjustStockDialog';
import { batchBadge } from '../../../features/admin/inventory/batchStatus';
import EditBatchDialog from '../../../features/admin/inventory/EditBatchDialog';
import MovementsTable from '../../../features/admin/inventory/MovementsTable';
import { useBatches } from '../../../features/admin/inventory/queries';
import ReceiveBatchDialog from '../../../features/admin/inventory/ReceiveBatchDialog';
import { useProduct } from '../../../features/admin/products/queries';
import { formatIsoDay } from '../../../lib/format';

type DialogState = { kind: 'receive' } | { kind: 'adjust' | 'edit'; batchId: string } | null;

function StatTile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function BatchActions({ batch, onAdjust, onEdit }: { batch: BatchView; onAdjust: () => void; onEdit: () => void }) {
  if (batch.status === 'written_off') return null;
  return (
    <span className="inline-flex gap-3">
      <button type="button" onClick={onAdjust} className="text-xs text-sage underline-offset-4 hover:underline">
        Adjust<span className="sr-only"> batch {batch.batchNumber}</span>
      </button>
      <button type="button" onClick={onEdit} className="text-xs text-sage underline-offset-4 hover:underline">
        Edit<span className="sr-only"> batch {batch.batchNumber}</span>
      </button>
    </span>
  );
}

export default function SizeStockPage() {
  const { productId = '', variantId = '' } = useParams();
  const product = useProduct(productId);
  const batches = useBatches(productId, variantId);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const backLink = (
    <Link to={`/admin/products/${productId}`} className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to product
    </Link>
  );

  if (product.isPending || batches.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {backLink}
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const variant = product.data?.variants.find((v) => v._id === variantId);
  if (product.isError || batches.isError || !variant || !product.data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {backLink}
        <div className="card">
          <PanelError
            error={product.error ?? batches.error ?? new Error('Size not found')}
            onRetry={() => {
              void product.refetch();
              void batches.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  const p = product.data.product;
  const { batches: list, stock } = batches.data;
  const selected = dialog && dialog.kind !== 'receive' ? list.find((b) => b.id === dialog.batchId) : undefined;
  const close = () => setDialog(null);
  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
  };
  const canReceive = variant.status !== 'archived';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-3">
        {backLink}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium">{p.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {variant.label} · SKU {variant.sku}
            </p>
          </div>
          {canReceive && (
            <button type="button" onClick={() => setDialog({ kind: 'receive' })} className="btn-primary gap-2">
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              Receive batch
            </button>
          )}
        </header>
      </div>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Available to sell" value={stock.available} hint="In batches still on sale, minus reserved units" />
        <StatTile label="Reserved" value={stock.reserved} hint="Held for orders that aren't packed yet" />
      </div>

      <Panel title="Batches" subtitle="Earliest expiry first. Orders are packed from the top.">
        {list.length === 0 ? (
          <EmptyState icon={Boxes} title="No batches yet" text="Receive the first batch to put this size on sale." />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Batch</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Left</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Expiry</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((b) => {
                  const badge = batchBadge(b);
                  return (
                    <tr key={b.id} className={`align-top ${b.status !== 'active' ? 'text-muted' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.batchNumber}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          Received {formatIsoDay(b.receivedDate)}
                          {b.origin ? ` · ${b.origin}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-medium">{b.quantityRemaining}</span>
                        <span className="text-muted"> of {b.quantityReceived}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p>{formatIsoDay(b.expiryDate)}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {b.isExpired ? 'Expired' : `in ${b.daysToExpiry} days`} · stops selling {formatIsoDay(b.stopsSellingOn)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <BatchActions
                          batch={b}
                          onAdjust={() => setDialog({ kind: 'adjust', batchId: b.id })}
                          onEdit={() => setDialog({ kind: 'edit', batchId: b.id })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {list.map((b) => {
                const badge = batchBadge(b);
                return (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{b.batchNumber}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {b.quantityRemaining} of {b.quantityReceived} left · expires {formatIsoDay(b.expiryDate)}
                        </p>
                      </div>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                    <div className="mt-2">
                      <BatchActions
                        batch={b}
                        onAdjust={() => setDialog({ kind: 'adjust', batchId: b.id })}
                        onEdit={() => setDialog({ kind: 'edit', batchId: b.id })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <MovementsTable filter={{ variant: variantId }} title="Stock movements for this size" />

      <ReceiveBatchDialog open={dialog?.kind === 'receive'} product={p} variant={variant} onClose={close} onDone={done} />
      {selected && (
        <>
          <AdjustStockDialog open={dialog?.kind === 'adjust'} productId={productId} variantId={variantId} batch={selected} onClose={close} onDone={done} />
          <EditBatchDialog open={dialog?.kind === 'edit'} productId={productId} variantId={variantId} batch={selected} onClose={close} onDone={done} />
        </>
      )}
    </div>
  );
}