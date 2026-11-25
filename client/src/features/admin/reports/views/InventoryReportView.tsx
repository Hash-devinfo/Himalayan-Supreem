import { Link } from 'react-router';
import { reportsApi } from '../../../../api/reports';
import Badge from '../../../../components/ui/Badge';
import FormAlert from '../../../../components/ui/FormAlert';
import { formatIsoDay } from '../../../../lib/format';
import { useReport } from '../queries';
import { Definitions, ReportTable, Stat, StatGrid } from '../ReportKit';
import { type DateRange, n, rs } from '../reportUtils';
import ReportState from '../ReportState';

export default function InventoryReportView({ range }: { range: DateRange }) {
  const query = useReport('inventory', range, () => reportsApi.inventory(range));

  return (
    <ReportState query={query}>
      {(data) => {
        const s = data.summary;
        return (
          <>
            <StatGrid>
              <Stat label="Available to sell" value={n(s.availableUnits)} hint={`${n(s.reservedUnits)} reserved for orders`} />
              <Stat label="On the shelf" value={n(s.onHandUnits)} hint={`${n(s.sizes)} sizes`} />
              <Stat label="Stock value" value={rs(s.stockValue)} hint={s.stockValueComplete ? 'At cost' : 'Some sizes have no cost'} />
              <Stat
                label="Need attention"
                value={n(s.lowStockSizes + s.expiringSoonBatches + s.stoppedSellingBatches)}
                hint={`${n(s.lowStockSizes)} low · ${n(s.expiringSoonBatches)} expiring · ${n(s.stoppedSellingBatches)} stopped`}
                tone={s.lowStockSizes + s.expiringSoonBatches + s.stoppedSellingBatches > 0 ? 'bad' : undefined}
              />
            </StatGrid>

            {data.stoppedSelling.length > 0 && (
              <FormAlert tone="danger" className="">
                {n(data.stoppedSelling.length)} {data.stoppedSelling.length === 1 ? 'batch has' : 'batches have'} stopped selling but are
                still on the shelf. Write them off in Inventory.
              </FormAlert>
            )}

            <ReportTable
              title="Stock now"
              subtitle={`As of ${new Date(data.asOf).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' })}`}
              columns={[
                {
                  label: 'Size',
                  value: (r) => (
                    <span>
                      {r.product} <span className="text-muted">({r.label})</span>
                      {r.low && (
                        <>
                          {' '}
                          <Badge tone="warning">Low</Badge>
                        </>
                      )}
                    </span>
                  ),
                },
                { label: 'SKU', value: (r) => r.sku },
                { label: 'On shelf', value: (r) => n(r.onHand), align: 'right' },
                { label: 'Sellable', value: (r) => n(r.sellable), align: 'right' },
                { label: 'Reserved', value: (r) => n(r.reserved), align: 'right' },
                { label: 'Available', value: (r) => n(r.available), align: 'right' },
                { label: 'Value', value: (r) => (r.costMissing ? 'No cost' : rs(r.stockValue)), align: 'right' },
              ]}
              rows={data.stock}
              rowKey={(r) => r.variantId}
              empty="No active sizes yet."
            />

            <ReportTable
              title={`Expiring within the warning days`}
              subtitle="Still on sale. Sell or discount these first."
              columns={[
                { label: 'Batch', value: (r) => r.batchNumber },
                { label: 'Size', value: (r) => `${r.product} (${r.label})` },
                { label: 'Units', value: (r) => n(r.quantityRemaining), align: 'right' },
                { label: 'Stops selling', value: (r) => formatIsoDay(r.stopsSellingOn), align: 'right' },
                { label: 'Expires', value: (r) => `${formatIsoDay(r.expiryDate)} (${r.daysToExpiry} days)`, align: 'right' },
              ]}
              rows={data.expiringSoon}
              rowKey={(r) => r.batchId}
              empty="No batches expiring soon."
            />

            <ReportTable
              title="Stock movements"
              subtitle={`What happened to stock from ${formatIsoDay(data.range.from)} to ${formatIsoDay(data.range.to)}`}
              columns={[
                { label: 'Movement', value: (r) => r.label },
                { label: 'Entries', value: (r) => n(r.entries), align: 'right' },
                { label: 'Units', value: (r) => n(r.units), align: 'right' },
              ]}
              rows={data.movements}
              rowKey={(r) => r.type}
              empty="No stock movements in these dates."
            />

            <p className="text-xs text-muted">
              For a single size's batches and full history, open it from{' '}
              <Link to="/admin/inventory" className="text-sage underline-offset-4 hover:underline">
                Inventory
              </Link>
              .
            </p>
            <Definitions definitions={data.definitions} />
          </>
        );
      }}
    </ReportState>
  );
}
