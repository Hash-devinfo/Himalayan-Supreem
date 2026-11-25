import { Link } from 'react-router';
import { reportsApi } from '../../../../api/reports';
import FormAlert from '../../../../components/ui/FormAlert';
import { useReport } from '../queries';
import { Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, rs } from '../reportUtils';
import ReportState from '../ReportState';

function OrderLinks({ numbers }: { numbers: string[] }) {
  return (
    <span className="flex flex-wrap gap-x-2">
      {numbers.map((num) => (
        <Link key={num} to={`/admin/orders/${num}`} className="text-sage underline-offset-4 hover:underline">
          {num}
        </Link>
      ))}
    </span>
  );
}

export default function ProfitReportView({ range }: { range: DateRange }) {
  const query = useReport('profit', range, () => reportsApi.profit(range));

  return (
    <ReportState query={query}>
      {(data) => {
        const s = data.summary;
        const m = data.missingCosts;
        const costLines = [
          { label: 'Product cost', value: s.productCost },
          { label: 'Packaging', value: s.packagingCost },
          { label: 'Courier fees', value: s.courierFees },
          { label: 'COD charges', value: s.codCharges },
          { label: `Failed deliveries (${n(s.returnedOrders)} returned)`, value: s.failedDeliveryCosts },
        ];
        return (
          <>
            {!m.complete && (
              <FormAlert tone="warning" className="">
                <span className="font-medium">Some costs are missing, so profit looks higher than it really is.</span>
                {m.sizesWithoutCost.length > 0 && (
                  <span className="mt-1 block">Sizes without a cost price: {m.sizesWithoutCost.join(', ')}. Add it on the size or the batch.</span>
                )}
                {m.ordersWithoutCourierFee.length > 0 && (
                  <span className="mt-1 block">
                    Orders without a courier fee: <OrderLinks numbers={m.ordersWithoutCourierFee} />
                  </span>
                )}
                {m.ordersWithoutPackagingCost.length > 0 && (
                  <span className="mt-1 block">
                    Orders without a packaging cost: <OrderLinks numbers={m.ordersWithoutPackagingCost} />
                  </span>
                )}
              </FormAlert>
            )}

            <StatGrid>
              <Stat label="Profit" value={rs(s.profit)} hint={`${s.marginPercent}% margin`} tone={s.profit < 0 ? 'bad' : 'good'} />
              <Stat label="Net sales" value={rs(s.netSales)} hint={`${n(s.deliveredOrders)} delivered orders`} />
              <Stat label="Delivery income" value={rs(s.deliveryIncome)} />
              <Stat label="All costs" value={rs(s.totalCosts)} />
            </StatGrid>

            <section className="card overflow-hidden">
              <header className="border-b border-line px-4 py-3">
                <h2 className="font-medium">How the profit adds up</h2>
              </header>
              <dl className="divide-y divide-line text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <dt>Net sales</dt>
                  <dd className="tabular-nums">{rs(s.netSales)}</dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt>+ Delivery income</dt>
                  <dd className="tabular-nums">{rs(s.deliveryIncome)}</dd>
                </div>
                {costLines.map((c) => (
                  <div key={c.label} className="flex justify-between px-4 py-2.5 text-muted">
                    <dt>− {c.label}</dt>
                    <dd className="tabular-nums">{rs(c.value)}</dd>
                  </div>
                ))}
                <div className="flex justify-between bg-canvas px-4 py-3 font-medium">
                  <dt>Profit</dt>
                  <dd className={`tabular-nums ${s.profit < 0 ? 'text-danger' : ''}`}>{rs(s.profit)}</dd>
                </div>
              </dl>
            </section>

            <ReportTable
              title="Gross profit by size"
              subtitle="Sales after discounts minus product cost. Packaging, courier and COD costs are per order, so they are not split here."
              columns={[
                { label: 'Size', value: (r) => r.label },
                { label: 'SKU', value: (r) => r.sku },
                { label: 'Units', value: (r) => n(r.qty), align: 'right' },
                { label: 'Sales', value: (r) => rs(r.sales), align: 'right' },
                { label: 'Cost', value: (r) => rs(r.cost), align: 'right' },
                { label: 'Gross profit', value: (r) => rs(r.grossProfit), align: 'right' },
                { label: 'Margin', value: (r) => `${r.marginPercent}%`, align: 'right' },
              ]}
              rows={data.bySize}
              rowKey={(r) => r.sku}
              empty="No orders were delivered in these dates."
            />
            <Definitions definitions={data.definitions} />
          </>
        );
      }}
    </ReportState>
  );
}
