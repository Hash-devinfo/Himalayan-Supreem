import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

type Tone = 'danger' | 'warning' | 'success';

const toneClass: Record<Tone, string> = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-sage-soft text-sage',
};

interface FormAlertProps {
  tone: Tone;
  children: ReactNode;
  className?: string;
}

export default function FormAlert({ tone, children, className = 'mb-5' }: FormAlertProps) {
  const Icon = tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <div
      role={tone === 'success' ? 'status' : 'alert'}
      className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${toneClass[tone]} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}