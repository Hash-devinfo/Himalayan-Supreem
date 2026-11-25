import { reportsApi, type SalesDayRow, type SalesGroup, type SalesProductRow } from '../../../../api/reports';
import { formatDay } from '../../../../lib/format';
import DayBars from '../DayBars';
import { useReport } from '../queries';
import { Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, rs, SALES_GROUPS } from '../reportUtils';
import ReportState from '../ReportState';

type Row = SalesDayRow & SalesProductRow;

export default function SalesReportView({ range, groupBy }: { range: DateRange; groupBy: SalesGroup }) {
  const query = useReport('sales', { ...range, groupBy }, () => reportsApi.sales<Row>({ ...range, groupBy }));
  const byTime = groupBy === 'day' || groupBy === 'courier';

  return (
    <ReportState query={query}>
      {(data) => (
        <>
          <StatGrid>
            <Stat label="Net sales" value={rs(data.summary.netSales)} hint="After discounts and refunds, without delivery" />
            <Stat label="Delivered orders" value={n(data.summary.deliveredOrders)} hint={`Average ${rs(data.summary.averageOrderValue)}`} />
            <Stat label="Discounts" value={rs(data.summary.discounts)} />
            <Stat
              label="Refunds paid"
              value={rs(data.summary.refunds)}
              hint={`${n(data.summary.refundCount)} ${data.summary.refundCount === 1 ? 'refund' : 'refunds'}`}
              tone={data.summary.refunds > 0 ? 'bad' : undefined}
            />
            <Stat label="Gross sales" value={rs(data.summary.grossSales)} hint="Before discounts" />
            <Stat label="Delivery charges" value={rs(data.summary.deliveryCharges)} hint="Paid by customers" />
            <Stat label="COD collected" value={rs(data.summary.codCollected)} />
            <Stat
              label="Orders placed"
              value={n(data.placed.total)}
              hint={`${n(data.placed.open)} open · ${n(data.placed.cancelled)} cancelled · ${n(data.placed.returned)} returned`}
            />
          </StatGrid>

          {groupBy === 'day' && <DayBars from={data.range.from} to={data.range.to} rows={data.rows} />}

          {byTime ? (
            <ReportTable<Row>
              title={groupBy === 'day' ? 'Days with deliveries' : 'By courier'}
              columns={[
                { label: groupBy === 'day' ? 'Day' : 'Courier', value: (r) => (groupBy === 'day' ? formatDay(r.key) : r.label) },
                { label: 'Orders', value: (r) => n(r.orders), align: 'right' },
                { label: 'Net sales', value: (r) => rs(r.sales), align: 'right' },
                { label: 'Delivery charges', value: (r) => rs(r.deliveryCharges), align: 'right' },
              ]}
              rows={groupBy === 'day' ? [...data.rows].reverse() : data.rows}
              rowKey={(r) => r.key}
              empty="No orders were delivered in these dates."
            />
          ) : (
            <ReportTable<Row>
              title={SALES_GROUPS.find((g) => g.value === groupBy)?.label ?? ''}
              subtitle="Biggest sellers first"
              columns={[
                { label: groupBy === 'category' ? 'Category' : 'Product', value: (r) => r.label },
                ...(groupBy === 'variant' ? [{ label: 'SKU', value: (r: Row) => r.sku ?? '' }] : []),
                { label: 'Units', value: (r) => n(r.qty), align: 'right' },
                { label: 'Orders', value: (r) => n(r.orders), align: 'right' },
                { label: 'Discounts', value: (r) => rs(r.discounts), align: 'right' },
                { label: 'Net sales', value: (r) => rs(r.sales), align: 'right' },
              ]}
              rows={data.rows}
              rowKey={(r, i) => r.productId ?? r.variantId ?? r.categoryId ?? String(i)}
              empty="No orders were delivered in these dates."
            />
          )}
          <Definitions definitions={data.definitions} />
        </>
      )}
    </ReportState>
  );
}
