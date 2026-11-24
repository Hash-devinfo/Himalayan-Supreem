import type { FormEvent, ReactNode } from 'react';
import { Check, Loader2 } from 'lucide-react';
import FormAlert from '../../../components/ui/FormAlert';
import { Panel } from '../dashboard/DashboardPanel';

interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  savedNotice?: string | null;
  onSubmit: () => void;
  children: ReactNode;
}

// One card = one form with its own Save button
export function SettingsSection({ title, subtitle, dirty, saving, error, savedNotice, onSubmit, children }: SettingsSectionProps) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4 p-4">
          {error && (
            <FormAlert tone="danger" className="">
              {error}
            </FormAlert>
          )}
          {children}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-line px-4 py-3">
          <span className="mr-auto text-xs">
            {dirty ? (
              <span className="text-warning">Unsaved changes</span>
            ) : savedNotice ? (
              <span className="inline-flex items-center gap-1 text-sage">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {savedNotice}
              </span>
            ) : null}
          </span>
          <button type="submit" disabled={!dirty || saving} className="btn-primary gap-2 px-4 py-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-danger">{message}</p> : null;
}

interface NumberFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  suffix?: string;
  error?: string;
  onChange: (value: string) => void;
}

export function NumberField({ id, label, hint, value, suffix, error, onChange }: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={`input-field mt-0 w-32 tabular-nums ${error ? 'border-danger' : ''}`}
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
      <FieldError message={error} />
    </div>
  );
}