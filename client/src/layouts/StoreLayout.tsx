import { Link, NavLink, Outlet } from 'react-router';
import { STORE_NAME } from '../lib/store';
import ThemeToggle from '../components/ui/ThemeToggle';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-muted'}`;

export default function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-medium tracking-tight">
            {STORE_NAME}
          </Link>
          <div className="flex items-center gap-6">
            <nav className="flex gap-6 text-sm">
              <NavLink to="/" end className={navClass}>
                Home
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
                © {new Date().getFullYear()} {STORE_NAME}
      </footer>
    </div>
  );
}