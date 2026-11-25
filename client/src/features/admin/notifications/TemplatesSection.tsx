import { useState } from 'react';
import { Mail, MessageCircle, Pencil } from 'lucide-react';
import type { MessageTemplate } from '../../../api/notifications';
import Badge from '../../../components/ui/Badge';
import { ListSkeleton, Panel, PanelError } from '../dashboard/DashboardPanel';
import { useTemplates } from './queries';
import TemplateDialog from './TemplateDialog';

function ChannelState({ icon: Icon, label, available, ready }: { icon: typeof Mail; label: string; available: boolean; ready: boolean }) {
  if (!available) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      {label}
      <Badge tone={ready ? 'success' : 'warning'}>{ready ? 'Written' : 'Not written'}</Badge>
    </span>
  );
}

export default function TemplatesSection({ onNotice }: { onNotice: (message: string) => void }) {
  const templates = useTemplates();
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const notReady = templates.data?.templates.filter((t) => (t.email && !t.emailReady) || (t.whatsapp && !t.whatsappReady)).length ?? 0;

  return (
    <>
      <Panel
        title="Message templates"
        subtitle={
          templates.data
            ? notReady > 0
              ? `${notReady} of ${templates.data.templates.length} messages still need wording. Unwritten messages are not sent.`
              : 'Every message is written.'
            : undefined
        }
      >
        {templates.isPending ? (
          <ListSkeleton rows={5} />
        ) : templates.isError ? (
          <PanelError error={templates.error} onRetry={() => void templates.refetch()} />
        ) : (
          <ul className="divide-y divide-line">
            {templates.data.templates.map((t) => (
              <li key={t.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    <ChannelState icon={Mail} label="Email" available={t.email} ready={t.emailReady} />
                    <ChannelState icon={MessageCircle} label="WhatsApp" available={t.whatsapp} ready={t.whatsappReady} />
                  </div>
                </div>
                <button type="button" onClick={() => setEditing(t)} className="btn-secondary gap-1.5 px-3 py-1.5 text-sm">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && templates.data && (
        <TemplateDialog
          open
          template={editing}
          placeholders={templates.data.placeholders}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            onNotice(message);
          }}
        />
      )}
    </>
  );
}