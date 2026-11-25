import { Link } from 'react-router';
import { reportsApi } from '../../../../api/reports';
import { useReport } from '../queries';
import { Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, pct, rs } from '../reportUtils';
import ReportState from '../ReportState';

export default function PromotionsReportView({ range }: { range: DateRange }) {
  const query = useReport('promotions', range, () => reportsApi.promotions(range));

  return (
    <ReportState query={query}>
      {(data) => {
        const s = data.summary;
        return (
          <>
            <StatGrid>
              <Stat label="Discount given" value={rs(s.discountGiven)} hint="On delivered orders" />
              <Stat label="Sales with a promotion" value={rs(s.salesAfterDiscount)} hint="After the discount" />
              <Stat label="Orders with a promotion" value={n(s.ordersWithPromotion)} hint={`${n(s.deliveredOrdersWithPromotion)} delivered`} />
              <Stat label="Share of delivered orders" value={pct(s.shareOfDeliveredOrders)} hint={`${n(s.promotionsUsed)} promotions used`} />
            </StatGrid>
            <ReportTable
              title="Promotions"
              columns={[
                {
                  label: 'Promotion',
                  value: (r) => (
                    <Link to={`/admin/promotions/${r.promotionId}`} className="text-sage underline-offset-4 hover:underline">
                      {r.name}
                      {r.code ? ` (${r.code})` : ''}
                    </Link>
                  ),
                },
                { label: 'Orders', value: (r) => n(r.orders), align: 'right' },
                { label: 'Delivered', value: (r) => n(r.delivered), align: 'right' },
                { label: 'Open', value: (r) => n(r.open), align: 'right' },
                { label: 'Cancelled', value: (r) => n(r.cancelled), align: 'right' },
                { label: 'Discount', value: (r) => rs(r.discountGiven), align: 'right' },
                { label: 'Sales', value: (r) => rs(r.salesAfterDiscount), align: 'right' },
              ]}
              rows={data.promotions}
              rowKey={(r) => r.promotionId}
              empty="No orders used a promotion in these dates."
            />
            <Definitions definitions={data.definitions} />
          </>
        );
      }}
    </ReportState>
  );
}
