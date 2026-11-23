import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'border border-line bg-canvas text-muted',
  info: 'border border-ink text-ink',
  success: 'bg-sage-soft text-sage',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export default function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  );
}