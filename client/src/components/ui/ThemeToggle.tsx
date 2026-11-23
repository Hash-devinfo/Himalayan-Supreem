import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '../../lib/theme';
import { useTheme } from '../../features/theme/useTheme';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'Same as device', icon: Monitor },
];

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={selected}
            title={label}
            onClick={() => setPreference(value)}
            className={`rounded-full p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-sage ${
              selected ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}