import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ExternalLink, LogOut, Menu, X } from 'lucide-react';
import { useAdminAuth } from '../features/admin/auth/useAdminAuth';
import { ADMIN_NAV, adminHref, findNavItem } from '../features/admin/navigation';
import { STORE_NAME } from '../lib/store';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? 'bg-ink text-canvas' : 'text-muted hover:bg-sage-soft hover:text-ink'
  }`;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-5 py-5">
        <p className="font-medium tracking-tight">{STORE_NAME}</p>
        <p className="text-xs text-muted">Admin</p>
      </div>

      <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {ADMIN_NAV.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, path, icon: Icon }) => (
                <li key={label}>
                  <NavLink to={adminHref(path)} end={path === ''} onClick={onNavigate} className={linkClass}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-sage-soft hover:text-ink"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          View store
        </a>
      </div>
    </>
  );
}

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = findNavItem(pathname);

  // While the phone menu is open: Escape closes it and the page behind doesn't scroll
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <SidebarContent />
      </aside>

      {/* Phone menu */}
      <div className={`fixed inset-0 z-40 md:hidden ${menuOpen ? '' : 'pointer-events-none'}`} inert={!menuOpen}>
        <div
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
        <aside
          id="admin-menu"
          aria-label="Admin menu"
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl transition-transform duration-200 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-4 rounded-md p-1.5 text-muted transition-colors hover:bg-sage-soft hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <SidebarContent onNavigate={() => setMenuOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            className="-ml-1.5 rounded-md p-1.5 text-muted transition-colors hover:bg-sage-soft hover:text-ink md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <p className="font-medium">{current?.label ?? 'Admin'}</p>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{admin?.name}</span>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Log out"
              className="btn-secondary gap-2 px-3 py-1.5"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}