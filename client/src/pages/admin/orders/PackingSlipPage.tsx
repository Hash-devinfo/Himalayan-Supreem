import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../api/client';
import { documentsApi } from '../../../api/orderDocuments';
import FormAlert from '../../../components/ui/FormAlert';
import Skeleton from '../../../components/ui/Skeleton';
import PrintToolbar from '../../../features/admin/orders/documents/PrintToolbar';
import { COURIER_LABELS } from '../../../features/admin/orders/orderLabels';
import { ORDERS_KEY } from '../../../features/admin/orders/queries';
import { formatIsoDay, formatRs } from '../../../lib/format';

const WIDTH = 'max-w-[148mm]'; // A5

export default function PackingSlipPage() {
  const { orderNumber = '' } = useParams();
  const backTo = `/admin/orders/${orderNumber}`;
  const query = useQuery({
    queryKey: [...ORDERS_KEY, 'packing-slip', orderNumber],
    queryFn: () => documentsApi.packingSlip(orderNumber),
  });

  if (query.isPending) {
    return (
      <div className="min-h-screen py-6">
        <PrintToolbar title="Packing slip" backTo={backTo} canPrint={false} widthClass={WIDTH} />
        <Skeleton className={`mx-auto h-[500px] ${WIDTH}`} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="min-h-screen py-6">
        <PrintToolbar title="Packing slip" backTo={backTo} canPrint={false} widthClass={WIDTH} />
        <div className={`mx-auto px-4 ${WIDTH}`}>
          <FormAlert tone="danger">
            {query.error instanceof ApiError ? query.error.message : 'Could not load the packing slip. Try again.'}
          </FormAlert>
        </div>
      </div>
    );
  }

  const slip = query.data.slip;

  return (
    <div className="min-h-screen py-6 print:py-0">
      <PrintToolbar title={`Packing slip ${slip.orderNumber}`} backTo={backTo} widthClass={WIDTH} />

      <article
        className={`page-slip mx-auto bg-white p-8 text-[12px] leading-relaxed text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none ${WIDTH}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
          <div>
            <p className="text-base font-semibold">{slip.store.name}</p>
            {slip.store.whatsapp && <p className="text-neutral-600">WhatsApp {slip.store.whatsapp}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-neutral-500">Packing slip</p>
            <p className="text-lg font-semibold">{slip.orderNumber}</p>
            <p className="text-neutral-600">Placed {formatIsoDay(slip.placedOn)}</p>
            {slip.packedOn && <p className="text-neutral-600">Packed {formatIsoDay(slip.packedOn)}</p>}
          </div>
        </header>

        <section className="py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Ship to</p>
          <p className="mt-1 text-base font-semibold">{slip.shipTo.name}</p>
          <p className="text-sm">{slip.shipTo.phone}</p>
          <p className="text-sm">{slip.shipTo.address}</p>
          <p className="text-sm font-medium">
            {slip.shipTo.city}, {slip.shipTo.province}
          </p>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-900 text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <th className="w-6 py-1.5" aria-label="Packed" />
              <th className="py-1.5 font-semibold">Item</th>
              <th className="py-1.5 text-right font-semibold">Qty</th>
            </tr>
          </thead>
          <tbody>
            {slip.items.map((item) => (
              <tr key={item.sku} className="border-b border-neutral-200 align-top">
                <td className="py-2">
                  <span className="mt-0.5 inline-block h-3.5 w-3.5 rounded-sm border border-neutral-700" aria-hidden="true" />
                </td>
                <td className="py-2 pr-3">
                  <p className="font-medium">
                    {item.name} · {item.variantLabel}
                  </p>
                  <p className="text-neutral-600">SKU {item.sku}</p>
                  {item.batches.map((b) => (
                    <p key={b.batchNumber} className="text-neutral-600">
                      Batch {b.batchNumber} × {b.qty} · exp. {formatIsoDay(b.expiryDate)}
                    </p>
                  ))}
                </td>
                <td className="py-2 text-right text-base font-semibold tabular-nums">{item.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-5 flex items-stretch justify-between gap-4">
          <div className="flex-1 rounded border-2 border-neutral-900 p-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider">Cash on delivery: collect</p>
            <p className="text-2xl font-bold tabular-nums">{formatRs(slip.payment.amountToCollect)}</p>
          </div>
          {(slip.courier || slip.trackingNumber) && (
            <div className="flex-1 rounded border border-neutral-300 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Courier</p>
              <p className="font-medium">{slip.courier ? COURIER_LABELS[slip.courier] : '—'}</p>
              {slip.trackingNumber && <p className="font-mono text-sm">{slip.trackingNumber}</p>}
            </div>
          )}
        </section>
      </article>
    </div>
  );
}