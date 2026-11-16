import { NavLink, Outlet } from 'react-router';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm ${isActive ? 'bg-stone-800 text-white' : 'hover:bg-stone-200'}`;

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-stone-800 md:flex-row">
      <aside className="border-b border-stone-200 bg-white p-4 md:w-56 md:border-b-0 md:border-r">
        <p className="mb-4 font-semibold">Admin</p>
        <nav className="flex gap-2 md:flex-col">
          <NavLink to="/admin" end className={linkClass}>
            Dashboard
          </NavLink>
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}