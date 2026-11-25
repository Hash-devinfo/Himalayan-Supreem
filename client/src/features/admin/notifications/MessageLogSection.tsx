import { useState } from 'react';
import { Link } from 'react-router';
import { Inbox, Loader2, RotateCw, Search } from 'lucide-react';
import { notificationsApi, type NotificationChannel, type NotificationLogItem, type NotificationStatus } from '../../../api/notifications';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Pagination from '../../../components/ui/Pagination';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatDateTime } from '../../../lib/format';
import { EmptyState, ListSkeleton, PanelError } from '../dashboard/DashboardPanel';
import { CHANNEL_LABELS, errorText, STATUS_INFO } from './notificationText';
import { useNotificationLog, useNotificationMutation } from './queries';

function RetryButton({ item, onNotice }: { item: NotificationLogItem; onNotice: (message: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const retry = useNotificationMutation(() => notificationsApi.retry(item.id));

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={retry.isPending}
        onClick={() => {
          setError(null);
          retry.mutate(undefined, {
            onSuccess: (result) =>
              onNotice(result.notification.status === 'sent' ? `Email to ${item.recipient} sent.` : `Still failing: ${result.notification.lastError ?? 'unknown reason'}`),
            onError: (err) => setError(errorText(err)),
          });
        }}
        className="btn-secondary gap-1.5 px-3 py-1.5 text-xs"
      >
        {retry.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}
        Retry
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

interface MessageLogProps {
  initialOrder?: string;
  onNotice: (message: string) => void;
}

export default function MessageLogSection({ initialOrder = '', onNotice }: MessageLogProps) {
  const [orderText, setOrderText] = useState(initialOrder);
  const order = useDebouncedValue(orderText.trim(), 500);
  const [status, setStatus] = useState<NotificationStatus | ''>('');
  const [channel, setChannel] = useState<NotificationChannel | ''>('');
  const [page, setPage] = useState(1);

  const log = useNotificationLog({ order: order || undefined, status: status || undefined, channel: channel || undefined, page, limit: 20 });
  const filtered = Boolean(order || status || channel);
  const orderNotFound = log.isError && order && log.error.message === 'Order not found';

  return (
    <section className="card overflow-hidden" aria-label="Message log">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="relative w-full sm:w-56">
          <label htmlFor="log-order" className="sr-only">
            Order number
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="log-order"
            type="search"
            value={orderText}
            onChange={(e) => {
              setOrderText(e.target.value);
              setPage(1);
            }}
            placeholder="Full order number"
            className="input-field mt-0 pl-10"
          />
        </div>
        <label htmlFor="log-status" className="sr-only">
          Status
        </label>
        <select
          id="log-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as NotificationStatus | '');
            setPage(1);
          }}
          className="input-field mt-0 w-full sm:w-auto"
        >
          <option value="">Any status</option>
          <option value="failed">Failed</option>
          <option value="sent">Sent</option>
          <option value="prepared">Opened in WhatsApp</option>
          <option value="queued">Sending</option>
        </select>
        <label htmlFor="log-channel" className="sr-only">
          Channel
        </label>
        <select
          id="log-channel"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as NotificationChannel | '');
            setPage(1);
          }}
          className="input-field mt-0 w-full sm:w-auto"
        >
          <option value="">Email and WhatsApp</option>
          <option value="email">Email</option>
          <option value="whatsapp_link">WhatsApp</option>
        </select>
      </div>

      {log.isPending ? (
        <ListSkeleton rows={5} />
      ) : orderNotFound ? (
        <EmptyState icon={Inbox} title="No order with that number" text="Type the full order number, e.g. ORD-261125-0001." />
      ) : log.isError ? (
        <PanelError error={log.error} onRetry={() => void log.refetch()} />
      ) : log.data.notifications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filtered ? 'No messages match' : 'No messages yet'}
          text={filtered ? 'Try other filters.' : 'Emails and WhatsApp messages to customers appear here.'}
        />
      ) : (
        <ul className={`divide-y divide-line ${log.isPlaceholderData ? 'opacity-60' : ''}`}>
          {log.data.notifications.map((n) => {
            const info = STATUS_INFO[n.status];
            return (
              <li key={n.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {n.label}
                      {n.orderNumber && (
                        <>
                          {' · '}
                          <Link to={`/admin/orders/${n.orderNumber}`} className="font-normal text-sage underline-offset-4 hover:underline">
                            {n.orderNumber}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 break-all text-xs text-muted">
                      {CHANNEL_LABELS[n.channel]} to {n.recipient}
                      {n.subject ? ` · "${n.subject}"` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(n.sentAt ?? n.createdAt)}
                      {n.attempts > 1 ? ` · ${n.attempts} attempts` : ''}
                    </p>
                    {n.status === 'failed' && n.lastError && <p className="mt-1 text-xs text-danger">{n.lastError}</p>}
                    {n.status === 'failed' && n.channel === 'email' && <RetryButton item={n} onNotice={onNotice} />}
                  </div>
                  <Badge tone={info.tone}>{info.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {log.data && log.data.total > 20 && (
        <div className="border-t border-line p-4">
          <Pagination page={page} pages={log.data.pages} total={log.data.total} noun="messages" onPage={setPage} />
        </div>
      )}

      {log.data?.notifications.some((n) => n.status === 'failed' && n.lastError?.includes('not set up')) && (
        <div className="border-t border-line p-4">
          <FormAlert tone="warning" className="">
            Email isn't set up on the server yet (SMTP settings in the server's .env), so emails fail. See the setup notes.
          </FormAlert>
        </div>
      )}
    </section>
  );
}