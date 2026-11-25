import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import FormAlert from '../../../components/ui/FormAlert';
import MessageLogSection from '../../../features/admin/notifications/MessageLogSection';
import TemplatesSection from '../../../features/admin/notifications/TemplatesSection';

const TABS = [
  { value: 'templates', label: 'Templates' },
  { value: 'log', label: 'Message log' },
] as const;

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'log' ? 'log' : 'templates';
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-medium">Notifications</h1>
        <p className="mt-1 text-sm text-muted">
          Emails go automatically when an order changes. WhatsApp messages open on your phone or computer, and you press Send.
        </p>
      </header>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      <div className="flex gap-1 border-b border-line" role="tablist" aria-label="Notifications">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setParams(t.value === 'log' ? { tab: 'log' } : {})}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.value ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <TemplatesSection onNotice={setNotice} />
      ) : (
        <MessageLogSection initialOrder={params.get('order') ?? ''} onNotice={setNotice} />
      )}
    </div>
  );
}