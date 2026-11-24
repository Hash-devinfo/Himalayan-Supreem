import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Ruler } from 'lucide-react';
import type { AdminProduct, AdminVariant } from '../../../api/catalog';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import { formatRs } from '../../../lib/format';
import { EmptyState, Panel } from '../dashboard/DashboardPanel';
import VariantDialog from './VariantDialog';
import { DEFAULT_LOW_STOCK, VARIANT_STATUS_LABELS, VARIANT_STATUS_TONES, formatSize } from './variantStatus';

type DialogState = { mode: 'new' } | { mode: 'edit'; id: string } | null;

function margin(v: AdminVariant): string | null {
  if (v.costPrice === undefined || v.price <= 0) return null;
  return `${Math.round(((v.price - v.costPrice) / v.price) * 100)}% margin`;
}

function StockCell({ v }: { v: AdminVariant }) {
  const low = v.status === 'active' && v.availableQty <= (v.lowStockThreshold ?? DEFAULT_LOW_STOCK);
  return (
    <span>
      <span className={`font-medium tabular-nums ${v.availableQty === 0 ? 'text-danger' : low ? 'text-warning' : ''}`}>
        {v.availableQty}
      </span>
      <span className="text-muted"> available</span>
      {v.reservedQty > 0 && <span className="block text-xs text-muted">{v.reservedQty} reserved for orders</span>}
      {low && v.availableQty > 0 && <span className="block text-xs text-warning">Low</span>}
    </span>
  );
}

export default function SizesCard({ product, variants }: { product: AdminProduct; variants: AdminVariant[] }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Look the size up from the latest data, so the dialog shows fresh status and stock
  const editing = dialog?.mode === 'edit' ? variants.find((v) => v._id === dialog.id) : undefined;
  const productArchived = product.status === 'archived';
  const activeCount = variants.filter((v) => v.status === 'active').length;

  const addButton = productArchived ? undefined : (
    <button type="button" onClick={() => setDialog({ mode: 'new' })} className="btn-primary shrink-0 gap-1.5 px-3 py-1.5 text-xs">
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Add size
    </button>
  );

  return (
    <Panel title="Sizes" subtitle="Each size has its own SKU, price and stock." action={addButton}>
      {notice && (
        <div className="px-4 pt-4">
          <FormAlert tone="success" className="">
            {notice}
          </FormAlert>
        </div>
      )}
      {variants.length > 0 && activeCount === 0 && (
        <div className="px-4 pt-4">
          <FormAlert tone="warning" className="">
            No size is active, so customers can't buy this product.
          </FormAlert>
        </div>
      )}

      {variants.length === 0 ? (
        <EmptyState icon={Ruler} title="No sizes yet" text="Add at least one size with its price before publishing." />
      ) : (
        <>
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Size</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Price</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Stock</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {variants.map((v) => (
                <tr key={v._id} className={`align-top ${v.status === 'archived' ? 'text-muted' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{v.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatSize(v.sizeValue, v.sizeUnit)} · SKU {v.sku} · {v.shippingWeightGrams} g packed
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-medium tabular-nums">{formatRs(v.price)}</p>
                    {v.costPrice !== undefined && (
                      <p className="mt-0.5 text-xs text-muted">
                        cost {formatRs(v.costPrice)} · {margin(v)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StockCell v={v} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={VARIANT_STATUS_TONES[v.status]}>{VARIANT_STATUS_LABELS[v.status]}</Badge>
                  </td>
                                    <td className="px-4 py-3 text-right">
                    <span className="inline-flex gap-3">
                      <Link to={`/admin/inventory/${product._id}/${v._id}`} className="text-xs text-sage underline-offset-4 hover:underline">
                        Stock<span className="sr-only"> for {v.label}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDialog({ mode: 'edit', id: v._id })}
                        className="text-xs text-sage underline-offset-4 hover:underline"
                      >
                        Edit<span className="sr-only"> {v.label}</span>
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

                    <ul className="divide-y divide-line md:hidden">
            {variants.map((v) => (
              <li key={v._id}>
                <button
                  type="button"
                  onClick={() => setDialog({ mode: 'edit', id: v._id })}
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-canvas"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{v.label}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">SKU {v.sku}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">{formatRs(v.price)}</span>
                      <Badge tone={VARIANT_STATUS_TONES[v.status]}>{VARIANT_STATUS_LABELS[v.status]}</Badge>
                    </div>
                  </div>
                  <div className="mt-1.5 text-xs">
                    <StockCell v={v} />
                  </div>
                </button>
                <Link
                  to={`/admin/inventory/${product._id}/${v._id}`}
                  className="block px-4 pb-3 text-xs text-sage underline-offset-4 hover:underline"
                >
                  Stock and batches
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        Stock comes from batches. Receive them in{' '}
        <Link to="/admin/inventory" className="text-sage underline-offset-4 hover:underline">
          Inventory
        </Link>
        .
      </p>

      <VariantDialog
        open={dialog !== null}
        product={product}
        variant={editing}
        onClose={() => setDialog(null)}
        onSaved={(message) => {
          setDialog(null);
          setNotice(message);
        }}
      />
    </Panel>
  );
}