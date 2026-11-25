import { reportsApi } from '../../../../api/reports';
import FormAlert from '../../../../components/ui/FormAlert';
import { useReport } from '../queries';
import { BarList, Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, pct, rs } from '../reportUtils';
import ReportState from '../ReportState';

export default function AnalyticsReportView({ range }: { range: DateRange }) {
  const query = useReport('analytics', range, () => reportsApi.analytics(range));

  return (
    <ReportState query={query}>
      {(data) => {
        const s = data.summary;
        return (
          <>
            {s.visitors === 0 && (
              <FormAlert tone="warning" className="">
                No visits recorded yet. Website numbers start once the storefront is live.
              </FormAlert>
            )}
            <StatGrid>
              <Stat label="Visitors" value={n(s.visitors)} hint={`${n(s.pageViews)} page views`} />
              <Stat label="Orders completed" value={n(s.ordersCompleted)} hint={`${n(s.checkoutStarts)} started checkout`} />
              <Stat label="Added to cart" value={n(s.addToCarts)} hint={`${n(s.productViews)} product views`} />
              <Stat label="Abandoned carts" value={n(s.abandonedCarts)} hint={`${rs(s.abandonedCartValue)} left in carts`} />
            </StatGrid>

            <BarList
              title="From viewing to ordering"
              subtitle="Visitors at each step, as a % of those who viewed a product"
              rows={data.funnel.map((f) => ({ label: f.step, value: f.visitors, display: `${n(f.visitors)} · ${pct(f.percentOfViewers)}` }))}
              empty="No visits yet."
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <BarList
                title="Most viewed products"
                rows={data.topProducts.map((p) => ({ label: p.product, value: p.views, display: n(p.views) }))}
                empty="No product views yet."
              />
              <BarList
                title="Most added to cart"
                rows={data.topAddedToCart.map((p) => ({ label: p.product, value: p.adds, display: n(p.adds) }))}
                empty="Nothing added to cart yet."
              />
            </div>

            <ReportTable
              title="Where visitors came from"
              columns={[
                { label: 'Source', value: (r) => r.source },
                { label: 'Visitors', value: (r) => n(r.visitors), align: 'right' },
                { label: 'Ordered', value: (r) => n(r.ordered), align: 'right' },
                { label: 'Order rate', value: (r) => pct(r.orderPercent), align: 'right' },
              ]}
              rows={data.trafficSources}
              rowKey={(r) => r.source}
              empty="No visits yet."
            />

            <ReportTable
              title="What customers searched for"
              subtitle="Searches with no results show what customers want that you don't list"
              columns={[
                { label: 'Search', value: (r) => r.search },
                { label: 'Times', value: (r) => n(r.searches), align: 'right' },
                { label: 'No results', value: (r) => (r.zeroResults ? <span className="text-danger">{n(r.zeroResults)}</span> : '0'), align: 'right' },
                { label: 'Avg results', value: (r) => String(r.avgResults), align: 'right' },
              ]}
              rows={data.topSearches}
              rowKey={(r) => r.search}
              empty="No searches yet."
            />
            <Definitions definitions={data.definitions} />
          </>
        );
      }}
    </ReportState>
  );
}
