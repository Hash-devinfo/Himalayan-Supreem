import { Circle, PhoneCall, type LucideIcon } from 'lucide-react';
import type { OrderDetail } from '../../../../api/orders';
import { formatDateTime } from '../../../../lib/format';
import { Panel } from '../../dashboard/DashboardPanel';
import { CONTACT_OUTCOME_LABELS } from '../orderLabels';
import { ORDER_STATUS_LABELS } from '../orderStatus';

interface TimelineEvent {
  key: string;
  at: string;
  icon: LucideIcon;
  iconClass: string;
  title: string;
  note?: string;
  who?: string;
}

function eventsFor(order: OrderDetail): TimelineEvent[] {
  const statusEvents = order.statusHistory.map((change, i) => ({
    key: `status-${i}`,
    at: change.at,
    icon: Circle,
    iconClass: 'text-muted',
    title: ORDER_STATUS_LABELS[change.status],
    note: change.note,
    who: change.by ? 'Admin' : 'Customer',
  }));

  const callEvents = order.contactAttempts.map((call, i) => ({
    key: `call-${i}`,
    at: call.at,
    icon: PhoneCall,
    iconClass:
      call.outcome === 'confirmed' ? 'text-sage' : call.outcome === 'customer_cancelled' ? 'text-danger' : 'text-warning',
    title: `Call ${call.attemptNo}: ${CONTACT_OUTCOME_LABELS[call.outcome]}`,
    note: call.note,
  }));

  return [...statusEvents, ...callEvents].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export default function OrderTimeline({ order }: { order: OrderDetail }) {
  const events = eventsFor(order);
  const calls = order.contactAttempts.length;

  return (
    <Panel title="Activity" subtitle={`${calls} ${calls === 1 ? 'call' : 'calls'} logged · newest first`}>
      <ol className="px-4 py-4">
        {events.map((event, i) => {
          const Icon = event.icon;
          const last = i === events.length - 1;
          return (
            <li key={event.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-line" aria-hidden="true" />}
              <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
                <Icon className={`h-3 w-3 ${event.iconClass}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{event.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateTime(event.at)}
                  {event.who ? ` · ${event.who}` : ''}
                </p>
                {event.note && (
                  <p className="mt-1.5 whitespace-pre-line rounded-md bg-canvas px-2.5 py-1.5 text-xs">{event.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}