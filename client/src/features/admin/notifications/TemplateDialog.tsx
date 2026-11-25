import { useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { notificationsApi, type MessageTemplate, type PlaceholderInfo, type TemplateUpdate } from '../../../api/notifications';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { displayPkMobile } from '../../../lib/phone';
import { useSettings } from '../settings/queries';
import { errorText, previewText, unknownPlaceholders } from './notificationText';
import { useNotificationMutation } from './queries';

type Field = 'emailSubject' | 'emailBody' | 'whatsappBody';

const LIMITS: Record<Field, number> = { emailSubject: 200, emailBody: 3000, whatsappBody: 1000 };
const LABELS: Record<Field, string> = { emailSubject: 'Email subject', emailBody: 'Email text', whatsappBody: 'WhatsApp text' };

interface TemplateFormProps {
  template: MessageTemplate;
  placeholders: PlaceholderInfo[];
  onClose: () => void;
  onDone: (message: string) => void;
}

function TemplateForm({ template, placeholders, onClose, onDone }: TemplateFormProps) {
  const settings = useSettings();
  const storeName = settings.data?.settings.store.name ?? 'Your store';
  const support = displayPkMobile(settings.data?.settings.store.whatsappNumber);

  const [values, setValues] = useState<Record<Field, string>>({
    emailSubject: template.emailSubject ?? '',
    emailBody: template.emailBody ?? '',
    whatsappBody: template.whatsappBody ?? '',
  });
  const [lastField, setLastField] = useState<Field>(template.email ? 'emailBody' : 'whatsappBody');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const refs = {
    emailSubject: useRef<HTMLInputElement>(null),
    emailBody: useRef<HTMLTextAreaElement>(null),
    whatsappBody: useRef<HTMLTextAreaElement>(null),
  };
  const mutation = useNotificationMutation((body: TemplateUpdate) => notificationsApi.updateTemplate(template.key, body));

  const known = new Set(placeholders.map((p) => p.placeholder.replace(/[{}]/g, '')));
  const fields: Field[] = [...(template.email ? (['emailSubject', 'emailBody'] as const) : []), ...(template.whatsapp ? (['whatsappBody'] as const) : [])];

  function change(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // Puts {{name}} where the cursor was in the last box you typed in
  function insert(placeholder: string) {
    const el = refs[lastField].current;
    const current = values[lastField];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    change(lastField, current.slice(0, start) + placeholder + current.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: Partial<Record<Field, string>> = {};
    for (const field of fields) {
      const text = values[field].trim();
      const unknown = unknownPlaceholders(text, known);
      if (text.length > LIMITS[field]) errors[field] = `${LABELS[field]} can be ${LIMITS[field]} characters at most`;
      else if (unknown.length > 0) errors[field] = `Unknown placeholder ${unknown.map((n) => `{{${n}}}`).join(', ')}. Use the buttons below.`;
    }
    if (template.email && Boolean(values.emailSubject.trim()) !== Boolean(values.emailBody.trim())) {
      errors[values.emailSubject.trim() ? 'emailBody' : 'emailSubject'] = 'An email needs both a subject and text, or neither';
    }
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    const body: TemplateUpdate = {};
    for (const field of fields) body[field] = values[field].trim() || null;
    mutation.mutate(body, {
      onSuccess: () => onDone(`"${template.label}" saved.`),
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        Write it in your own words. Leave a message empty and it isn't sent. Placeholders are filled in for each order.
      </p>

      <div className="mt-4 space-y-4">
        {fields.map((field) => {
          const common = {
            id: `tpl-${field}`,
            value: values[field],
            onFocus: () => setLastField(field),
            className: `input-field ${field === 'emailSubject' ? '' : 'resize-y'} ${fieldErrors[field] ? 'border-danger' : ''}`,
          };
          return (
            <div key={field}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`tpl-${field}`} className="block text-sm font-medium">
                  {LABELS[field]}
                </label>
                <span className="text-xs tabular-nums text-muted">
                  {values[field].length} / {LIMITS[field]}
                </span>
              </div>
              {field === 'emailSubject' ? (
                <input ref={refs.emailSubject} {...common} onChange={(e) => change(field, e.target.value)} />
              ) : (
                <textarea
                  ref={field === 'emailBody' ? refs.emailBody : refs.whatsappBody}
                  rows={field === 'emailBody' ? 7 : 5}
                  {...common}
                  onChange={(e) => change(field, e.target.value)}
                />
              )}
              {fieldErrors[field] && <p className="mt-1.5 text-xs text-danger">{fieldErrors[field]}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted">Insert a placeholder (goes where your cursor is)</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {placeholders.map((p) => (
            <button
              key={p.placeholder}
              type="button"
              title={p.meaning}
              onClick={() => insert(p.placeholder)}
              className="rounded-full border border-line px-2.5 py-1 font-mono text-xs transition-colors hover:border-ink"
            >
              {p.placeholder}
            </button>
          ))}
        </div>
      </div>

      {fields.some((f) => values[f].trim()) && (
        <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
          <p className="text-xs font-medium text-muted">Preview with fictional sample details</p>
          {template.email && values.emailSubject.trim() && (
            <p className="mt-2 text-sm font-medium">{previewText(values.emailSubject, storeName, support)}</p>
          )}
          {template.email && values.emailBody.trim() && (
            <p className="mt-1 whitespace-pre-line text-sm">{previewText(values.emailBody, storeName, support)}</p>
          )}
          {template.whatsapp && values.whatsappBody.trim() && (
            <>
              {template.email && <p className="mt-4 text-xs font-medium text-muted">WhatsApp</p>}
              <p className="mt-2 inline-block max-w-full whitespace-pre-line rounded-2xl rounded-tl-sm bg-sage-soft px-3 py-2 text-sm">
                {previewText(values.whatsappBody, storeName, support)}
              </p>
            </>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save message
        </button>
      </div>
    </form>
  );
}

export default function TemplateDialog({ open, ...props }: TemplateFormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={props.template.label}>
      <TemplateForm {...props} />
    </Modal>
  );
}