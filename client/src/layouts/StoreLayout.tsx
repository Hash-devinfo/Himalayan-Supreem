import { Link, Outlet } from 'react-router';

export default function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-800">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Placeholder until the store name/logo is final */}
          <Link to="/" className="text-lg font-semibold">
            [Store Name]
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/">Home</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} [Store Name]
      </footer>
    </div>
  );
}