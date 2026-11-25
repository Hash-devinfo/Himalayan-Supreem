import { useState } from 'react';
import { Link } from 'react-router';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { notificationsApi, type TemplateKey } from '../../../api/notifications';
import FormAlert from '../../../components/ui/FormAlert';
import { ListSkeleton, Panel, PanelError } from '../dashboard/DashboardPanel';
import { errorText } from './notificationText';
import { useNotificationMutation, useWhatsappOptions } from './queries';

// On the order screen: opens WhatsApp with the chosen message already written for this order.
// You press Send in WhatsApp; automatic sending needs the WhatsApp Business API (later).
export default function WhatsAppCard({ orderNumber }: { orderNumber: string }) {
  const options = useWhatsappOptions(orderNumber);
  const [chosen, setChosen] = useState<TemplateKey | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [lastText, setLastText] = useState<string | null>(null);
  const prepare = useNotificationMutation((key: TemplateKey) => notificationsApi.prepareWhatsapp(orderNumber, key));

  const messages = options.data?.messages ?? [];
  const selected = chosen || options.data?.suggested || messages.find((m) => m.ready)?.key || '';
  const selectedReady = messages.find((m) => m.key === selected)?.ready ?? false;

  function open() {
    if (!selected) return;
    setError(null);
    // Open the tab now (browsers block tabs opened after waiting), then send it to WhatsApp
    const tab = window.open('', '_blank');
    prepare.mutate(selected, {
      onSuccess: (result) => {
        setLastText(result.text);
        if (tab) {
          tab.opener = null;
          tab.location.href = result.link;
        } else {
          window.location.href = result.link;
        }
      },
      onError: (err) => {
        tab?.close();
        setError(errorText(err));
      },
    });
  }

  return (
    <Panel
      title="WhatsApp message"
      subtitle="Opens WhatsApp with the message written for this order. You press Send."
      action={
        <Link to={`/admin/notifications?tab=log&order=${orderNumber}`} className="shrink-0 text-xs text-sage underline-offset-4 hover:underline">
          History
        </Link>
      }
    >
      {options.isPending ? (
        <ListSkeleton rows={1} />
      ) : options.isError ? (
        <PanelError error={options.error} onRetry={() => void options.refetch()} />
      ) : (
        <div className="space-y-3 px-4 py-3">
          <label htmlFor={`wa-${orderNumber}`} className="sr-only">
            Message
          </label>
          <select
            id={`wa-${orderNumber}`}
            value={selected}
            onChange={(e) => setChosen(e.target.value as TemplateKey)}
            className="input-field mt-0"
          >
            {messages.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
                {m.suggested ? ' (fits now)' : ''}
                {m.ready ? '' : ' (not written)'}
              </option>
            ))}
          </select>
          {!selectedReady ? (
            <p className="text-xs text-muted">
              This message isn't written yet.{' '}
              <Link to="/admin/notifications" className="text-sage underline-offset-4 hover:underline">
                Write it in Notifications
              </Link>
              .
            </p>
          ) : (
            <button type="button" onClick={open} disabled={prepare.isPending} className="btn-primary w-full gap-2">
              {prepare.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Open in WhatsApp
            </button>
          )}
          {error && (
            <FormAlert tone="danger" className="">
              {error}
            </FormAlert>
          )}
          {lastText && (
            <div>
              <p className="flex items-center gap-1 text-xs text-muted">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Last message opened
              </p>
              <p className="mt-1 whitespace-pre-line rounded-2xl rounded-tl-sm bg-sage-soft px-3 py-2 text-sm">{lastText}</p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}