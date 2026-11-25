import { Link } from 'react-router';
import { reportsApi } from '../../../../api/reports';
import { phoneForUrl } from '../../../../api/customers';
import Badge from '../../../../components/ui/Badge';
import { useReport } from '../queries';
import { Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, pct } from '../reportUtils';
import ReportState from '../ReportState';

export default function RiskReportView({ range }: { range: DateRange }) {
  const query = useReport('risk', range, () => reportsApi.risk(range));

  return (
    <ReportState query={query}>
      {(data) => {
        const s = data.summary;
        return (
          <>
            <StatGrid>
              <Stat label="Refused or not collected" value={n(s.refused)} hint={`${pct(s.refusalPercent)} of parcels at the door`} tone={s.refused > 0 ? 'bad' : undefined} />
              <Stat label="Cancelled" value={n(s.cancelled)} hint={`${pct(s.cancellationPercent)} of orders placed`} />
              <Stat label="Orders placed" value={n(s.ordersPlaced)} hint={`${n(s.delivered)} delivered`} />
              <Stat label="High-risk rule" value={`${n(s.highRiskThreshold)} refusals`} hint="Change it in Settings" />
            </StatGrid>
            <ReportTable
              title="By city"
              subtitle="Where parcels come back most"
              columns={[
                { label: 'City', value: (r) => `${r.city}, ${r.province}` },
                { label: 'Orders', value: (r) => n(r.orders), align: 'right' },
                { label: 'Delivered', value: (r) => n(r.delivered), align: 'right' },
                { label: 'Refused', value: (r) => n(r.refused), align: 'right' },
                { label: 'Refusal rate', value: (r) => pct(r.refusalPercent), align: 'right' },
                { label: 'Cancelled', value: (r) => n(r.cancelled), align: 'right' },
              ]}
              rows={data.byCity}
              rowKey={(r) => `${r.city}-${r.province}`}
              empty="No orders placed in these dates."
            />
            <ReportTable
              title="Phone numbers with refusals or cancellations"
              subtitle="Most refusals first. Risk badge is all-time."
              columns={[
                {
                  label: 'Customer',
                  value: (r) => (
                    <Link to={`/admin/customers/${phoneForUrl(r.phone)}`} className="text-sage underline-offset-4 hover:underline">
                      {r.name} · {r.phone}
                    </Link>
                  ),
                },
                { label: 'Orders', value: (r) => n(r.orders), align: 'right' },
                { label: 'Refused', value: (r) => n(r.refused), align: 'right' },
                { label: 'Cancelled', value: (r) => n(r.cancelled), align: 'right' },
                {
                  label: 'Risk',
                  value: (r) =>
                    r.riskLevel === 'normal' ? '—' : <Badge tone="danger">{r.riskLevel === 'blocked' ? 'Blocked' : 'High risk'}</Badge>,
                  align: 'right',
                },
              ]}
              rows={data.phones}
              rowKey={(r) => r.phone}
              empty="No refusals or cancellations in these dates."
            />
            <Definitions definitions={data.definitions} />
          </>
        );
      }}
    </ReportState>
  );
}
