import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { STORE_NAME } from '../../../lib/store';
import ThemeToggle from '../../../components/ui/ThemeToggle';


interface AuthShellProps {
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthShell({ children, footer }: AuthShellProps) {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      {/* Left panel: desktop only */}
      <section className="hidden flex-col justify-between bg-sage-soft p-10 md:flex">
        <p className="text-lg font-medium tracking-tight">{STORE_NAME}</p>
        <div>
          <p className="text-3xl font-medium leading-tight">
            Orders, stock and deliveries,
            <br />
            all in one place.
          </p>
          <p className="mt-3 text-sm text-muted">Admin area. Authorised access only.</p>
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} {STORE_NAME}</p>
      </section>

      <section className="relative flex items-center justify-center px-4 py-12">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-sm motion-safe:animate-fade-up">
          <p className="mb-6 text-center text-lg font-medium tracking-tight md:hidden">{STORE_NAME}</p>
          {children}
          {footer && <div className="mt-6 text-center text-xs text-muted">{footer}</div>}
        </div>
      </section>
    </main>
  );
}

export function BackToLoginLink() {
  return (
    <Link to="/admin/login" className="inline-flex items-center gap-1 transition-colors hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      Back to login
    </Link>
  );
}