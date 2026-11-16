import { Link, NavLink, Outlet } from 'react-router';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-muted'}`;

export default function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          {/* Placeholder until the store name/logo is final */}
          <Link to="/" className="text-lg font-medium tracking-tight">
            [Store Name]
          </Link>
          <nav className="flex gap-6 text-sm">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} [Store Name]
      </footer>
    </div>
  );
}