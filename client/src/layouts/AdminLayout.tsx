import { NavLink, Outlet } from 'react-router';
import { useAdminAuth } from '../features/admin/auth/useAdminAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? 'bg-ink text-canvas' : 'text-muted hover:bg-sage-soft hover:text-ink'
  }`;

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface p-4 md:w-56 md:border-b-0 md:border-r">
        <p className="mb-4 px-3 font-medium">Admin</p>
        <nav className="flex gap-2 md:flex-col">
          <NavLink to="/admin" end className={linkClass}>
            Dashboard
          </NavLink>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-line bg-surface px-4 py-3 text-sm">
          <span className="text-muted">{admin?.name}</span>
          <button type="button" onClick={() => void logout()} className="btn-secondary px-4 py-1.5">
            Log out
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}