import { MessageCircle, Phone } from 'lucide-react';
import type { OrderDetailResponse } from '../../../../api/orders';
import CopyButton from '../../../../components/ui/CopyButton';
import { Panel } from '../../dashboard/DashboardPanel';

export default function CustomerCard({ data }: { data: OrderDetailResponse }) {
  const { order, risk, contact } = data;
  const customer = order.customerSnapshot;
  const address = customer.address;

  const addressLines = [address.line1, address.line2, address.area, `${address.city}, ${address.province}`].filter(
    (line): line is string => Boolean(line),
  );
  const forCourier = [customer.name, contact.phone, ...addressLines].join('\n');

  const history = [
    { label: 'Orders', value: risk.orders, bad: false },
    { label: 'Delivered', value: risk.delivered, bad: false },
    { label: 'Refused', value: risk.refused, bad: risk.refused > 0 },
    { label: 'Cancelled', value: risk.cancelled, bad: false },
  ];

  return (
    <Panel title="Customer">
      <div className="space-y-4 p-4">
        <div>
          <p className="font-medium">{customer.name}</p>
          <p className="mt-0.5 text-sm tabular-nums text-muted">{contact.phone}</p>
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              className="mt-0.5 block break-all text-sm text-sage underline-offset-4 hover:underline"
            >
              {customer.email}
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a href={contact.callLink} className="btn-primary gap-2">
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call
          </a>
          <a href={contact.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-secondary gap-2">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Delivery address</p>
            <CopyButton text={forCourier} label="Copy name, phone and address" />
          </div>
          <address className="mt-1 text-sm not-italic leading-relaxed">
            {addressLines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>
      </div>

      <div className="border-t border-line p-4">
        <p className="text-xs font-medium text-muted">History with this number</p>
        <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
          {history.map((item) => (
            <div key={item.label} className="rounded-lg bg-canvas px-1 py-2">
              <dt className="text-[11px] text-muted">{item.label}</dt>
              <dd className={`text-base font-medium tabular-nums ${item.bad ? 'text-danger' : ''}`}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}