import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../api/client';
import { documentsApi } from '../../../api/orderDocuments';
import FormAlert from '../../../components/ui/FormAlert';
import Skeleton from '../../../components/ui/Skeleton';
import PrintToolbar from '../../../features/admin/orders/documents/PrintToolbar';
import { ORDERS_KEY } from '../../../features/admin/orders/queries';
import { formatIsoDay, formatRs } from '../../../lib/format';

const REFUND_REASONS = { damaged: 'Damaged product', incorrect: 'Incorrect product' } as const;

export default function InvoicePage() {
  const { orderNumber = '' } = useParams();
  const backTo = `/admin/orders/${orderNumber}`;
  const query = useQuery({
    queryKey: [...ORDERS_KEY, 'invoice', orderNumber],
    queryFn: () => documentsApi.invoice(orderNumber),
  });

  if (query.isPending) {
    return (
      <div className="min-h-screen py-6">
        <PrintToolbar title="Invoice" backTo={backTo} canPrint={false} />
        <Skeleton className="mx-auto h-[600px] max-w-[210mm]" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="min-h-screen py-6">
        <PrintToolbar title="Invoice" backTo={backTo} canPrint={false} />
        <div className="mx-auto max-w-[210mm] px-4">
          <FormAlert tone="danger">
            {query.error instanceof ApiError ? query.error.message : 'Could not load the invoice. Try again.'}
          </FormAlert>
        </div>
      </div>
    );
  }

  const { invoice: inv, notices } = query.data;
  const t = inv.totals;

  return (
    <div className="min-h-screen py-6 print:py-0">
      <PrintToolbar title={`Invoice ${inv.invoiceNumber}`} backTo={backTo} notices={notices} />

      <article className="mx-auto max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-300 pb-6">
          <div>
            <p className="text-xl font-semibold">{inv.seller.name}</p>
            {inv.seller.whatsapp && <p className="text-neutral-600">WhatsApp {inv.seller.whatsapp}</p>}
            {inv.seller.email && <p className="text-neutral-600">{inv.seller.email}</p>}
            {inv.seller.supportHours && <p className="text-neutral-600">{inv.seller.supportHours}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight">Invoice</p>
            <p className="mt-1">
              No. <span className="font-medium">{inv.invoiceNumber}</span>
            </p>
            <p className="text-neutral-600">Date {formatIsoDay(inv.invoiceDate)}</p>
            <p className="text-neutral-600">Order status: {inv.orderStatus}</p>
          </div>
        </header>

        <section className="py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Bill to</p>
          <p className="mt-1 font-medium">{inv.billTo.name}</p>
          <p>{inv.billTo.phone}</p>
          {inv.billTo.email && <p>{inv.billTo.email}</p>}
          <p>{inv.billTo.address}</p>
          <p>
            {inv.billTo.city}, {inv.billTo.province}
          </p>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-900 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Price</th>
              <th className="py-2 text-right font-semibold">Discount</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item) => (
              <tr key={item.sku} className="border-b border-neutral-200 align-top">
                <td className="py-2.5 pr-4">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-neutral-600">
                    {item.variantLabel} · SKU {item.sku}
                  </p>
                  {item.batches.length > 0 && (
                    <p className="text-xs text-neutral-600">
                      Batch{' '}
                      {item.batches
                        .map((b) => `${b.batchNumber} (exp. ${formatIsoDay(b.expiryDate)})${item.batches.length > 1 ? ` × ${b.qty}` : ''}`)
                        .join(', ')}
                    </p>
                  )}
                </td>
                <td className="py-2.5 text-right tabular-nums">{item.qty}</td>
                <td className="py-2.5 text-right tabular-nums">{formatRs(item.unitPrice)}</td>
                <td className="py-2.5 text-right tabular-nums">{item.discount > 0 ? `−${formatRs(item.discount)}` : '—'}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">{formatRs(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-64 space-y-1">
            <div className="flex justify-between">
              <dt className="text-neutral-600">Subtotal</dt>
              <dd className="tabular-nums">{formatRs(t.subtotal)}</dd>
            </div>
            {t.discounts > 0 && (
              <div className="flex justify-between">
                <dt className="text-neutral-600">Discount</dt>
                <dd className="tabular-nums">−{formatRs(t.discounts)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-neutral-600">Delivery</dt>
              <dd className="tabular-nums">{t.deliveryCharge === 0 ? 'Free' : formatRs(t.deliveryCharge)}</dd>
            </div>
            <div className="flex justify-between border-t border-neutral-900 pt-1.5 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatRs(t.total)}</dd>
            </div>
            {t.refunded > 0 && (
              <>
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Refunded</dt>
                  <dd className="tabular-nums">−{formatRs(t.refunded)}</dd>
                </div>
                <div className="flex justify-between font-medium">
                  <dt>Net paid</dt>
                  <dd className="tabular-nums">{formatRs(t.netPaid)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        <section className="mt-8 rounded border border-neutral-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Payment</p>
          <p className="mt-1">
            {inv.payment.method}: {inv.payment.status}
          </p>
          {inv.payment.collectedOn && (
            <p className="text-neutral-600">
              {formatRs(inv.payment.amountCollected)} collected on {formatIsoDay(inv.payment.collectedOn)}
            </p>
          )}
          {inv.refunds.map((refund, i) => (
            <p key={i} className="text-neutral-600">
              Refund {formatRs(refund.amount)} · {REFUND_REASONS[refund.reason]}
              {refund.paidOn ? ` · paid ${formatIsoDay(refund.paidOn)}` : ''}
            </p>
          ))}
        </section>

        <p className="mt-8 text-center text-xs text-neutral-500">Amounts in Pakistani rupees (PKR).</p>
      </article>
    </div>
  );
}