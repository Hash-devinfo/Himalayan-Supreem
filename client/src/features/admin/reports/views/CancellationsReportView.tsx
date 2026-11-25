import { Link } from 'react-router';
import { reportsApi } from '../../../../api/reports';
import { formatIsoDay } from '../../../../lib/format';
import { useReport } from '../queries';
import { BarList, Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, pct, rs } from '../reportUtils';
import ReportState from '../ReportState';

const REFUND_STATUS: Record<string, string> = { requested: 'To review', approved: 'To pay', paid: 'Paid', rejected: 'Rejected' };

export default function CancellationsReportView({ range }: { range: DateRange }) {
  const query = useReport('cancellations', range, () => reportsApi.cancellations(range));

  return (
    <ReportState query={query}>
      {(data) => {
        const s = data.summary;
        return (
          <>
            <StatGrid>
              <Stat label="Cancelled" value={n(s.cancelled)} hint={`${pct(s.cancellationPercent)} of orders placed`} tone={s.cancelled > 0 ? 'bad' : undefined} />
              <Stat label="Cancelled value" value={rs(s.cancelledValue)} hint="Never shipped, no stock lost" />
              <Stat label="Refunds paid" value={rs(s.refundsPaidAmount)} hint={`${n(s.refundsPaid)} refunds · ${n(s.refundsWrittenOff)} units written off`} />
              <Stat
                label="Open refunds"
                value={n(s.openRefunds)}
                hint={`${rs(s.openRefundsAmount)} waiting (all time)`}
                tone={s.openRefunds > 0 ? 'bad' : undefined}
              />
            </StatGrid>

            <div className="grid gap-5 lg:grid-cols-2">
              <BarList
                title="Cancellations by type"
                rows={data.cancellations.byType.map((r) => ({ label: r.label, value: r.orders, display: `${n(r.orders)} · ${rs(r.value)}` }))}
                empty="No cancellations in these dates."
              />
              <BarList
                title="Refunds paid, by reason"
                rows={data.refunds.paidByReason.map((r) => ({ label: r.label, value: r.amount, display: `${rs(r.amount)} · ${n(r.refunds)}` }))}
                empty="No refunds paid in these dates."
              />
            </div>

            <ReportTable
              title="Open refunds"
              subtitle="Waiting for a decision or payment"
              columns={[
                { label: 'Order', value: (r) => r.orderNumber },
                { label: 'Reason', value: (r) => r.reason },
                { label: 'Status', value: (r) => REFUND_STATUS[r.status] ?? r.status },
                { label: 'Recorded', value: (r) => formatIsoDay(r.recordedOn), align: 'right' },
                {
                  label: 'Amount',
                  value: (r) => (
                    <Link to={`/admin/refunds/${r.refundId}`} className="text-sage underline-offset-4 hover:underline">
                      {rs(r.amount)}
                    </Link>
                  ),
                  align: 'right',
                },
              ]}
              rows={data.refunds.open}
              rowKey={(r) => r.refundId}
              empty="No open refunds."
            />

            <ReportTable
              title="Refunds paid, by product"
              columns={[
                { label: 'Product', value: (r) => r.label },
                { label: 'SKU', value: (r) => r.sku },
                { label: 'Units', value: (r) => n(r.qty), align: 'right' },
                { label: 'Refunds', value: (r) => n(r.refunds), align: 'right' },
                { label: 'Amount', value: (r) => rs(r.amount), align: 'right' },
              ]}
              rows={data.refunds.paidByProduct}
              rowKey={(r) => r.sku}
              empty="No refunds paid in these dates."
            />

            <ReportTable
              title="Cancelled orders"
              subtitle="Newest first, with the reason you recorded"
              columns={[
                {
                  label: 'Order',
                  value: (r) => (
                    <Link to={`/admin/orders/${r.orderNumber}`} className="text-sage underline-offset-4 hover:underline">
                      {r.orderNumber}
                    </Link>
                  ),
                },
                { label: 'Date', value: (r) => (r.date ? formatIsoDay(r.date) : '—') },
                { label: 'Type', value: (r) => r.type },
                { label: 'Reason', value: (r) => r.reason || '—' },
                { label: 'Value', value: (r) => rs(r.value), align: 'right' },
              ]}
              rows={data.cancellations.recent}
              rowKey={(r) => r.orderNumber}
              empty="No cancellations in these dates."
            />
            <Definitions definitions={data.definitions} />
          </>
        );
      }}
    </ReportState>
  );
}
