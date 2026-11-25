import { reportsApi } from '../../../../api/reports';
import { useReport } from '../queries';
import { BarList, Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, pct, rs } from '../reportUtils';
import ReportState from '../ReportState';

export default function FulfillmentReportView({ range }: { range: DateRange }) {
  const query = useReport('fulfillment', range, () => reportsApi.fulfillment(range));

  return (
    <ReportState query={query}>
      {(data) => {
        const s = data.summary;
        return (
          <>
            <StatGrid>
              <Stat label="Delivery success" value={pct(s.successPercent)} hint={`${n(s.delivered)} delivered · ${n(s.failed)} failed`} />
              <Stat label="Returned" value={n(s.returned)} tone={s.returned > 0 ? 'bad' : undefined} />
              <Stat
                label="COD with couriers"
                value={rs(s.codHeldAmount)}
                hint={`${n(s.codHeldOrders)} orders, not yet paid to you (all time)`}
                tone={s.codHeldAmount > 0 ? 'bad' : undefined}
              />
              <Stat label="COD paid to you" value={rs(s.codRemittedAmount)} hint="In these dates" />
            </StatGrid>

            <ReportTable
              title="Couriers"
              columns={[
                { label: 'Courier', value: (r) => r.label },
                { label: 'Delivered', value: (r) => n(r.delivered), align: 'right' },
                { label: 'Failed', value: (r) => n(r.failed), align: 'right' },
                { label: 'Returned', value: (r) => n(r.returned), align: 'right' },
                { label: 'Success', value: (r) => pct(r.successPercent), align: 'right' },
                { label: 'Avg days to deliver', value: (r) => (r.avgDaysToDeliver === null ? '—' : String(r.avgDaysToDeliver)), align: 'right' },
              ]}
              rows={data.couriers ?? []}
              rowKey={(r) => r.courier}
              empty="Nothing was delivered or failed in these dates."
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <BarList
                title="Why deliveries failed"
                rows={(data.failures ?? []).map((f) => ({ label: f.label, value: f.orders, display: n(f.orders) }))}
                empty="No failed deliveries in these dates."
              />
              <BarList
                title="Orders placed, by status today"
                rows={data.ordersByStatus.filter((r) => r.count > 0).map((r) => ({ label: r.label, value: r.count, display: n(r.count) }))}
                empty="No orders placed in these dates."
              />
            </div>

            <ReportTable
              title="COD still with couriers"
              subtitle="All time, as of now. Chase the oldest first."
              columns={[
                { label: 'Courier', value: (r) => r.label },
                { label: 'Orders', value: (r) => n(r.orders), align: 'right' },
                { label: 'Amount', value: (r) => rs(r.amount), align: 'right' },
                { label: 'Oldest', value: (r) => (r.oldestDeliveredDaysAgo === null ? '—' : `${r.oldestDeliveredDaysAgo} days ago`), align: 'right' },
              ]}
              rows={data.codHeld ?? []}
              rowKey={(r) => r.courier}
              empty="Couriers have paid you for every delivered order."
            />
            <Definitions definitions={data.definitions} />
          </>
        );
      }}
    </ReportState>
  );
}
