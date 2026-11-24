import { Navigate, Route, Routes } from 'react-router';
import AdminAuthProvider from '../../features/admin/auth/AdminAuthProvider';
import RequireAdmin from '../../features/admin/auth/RequireAdmin';
import { ADMIN_NAV_ITEMS } from '../../features/admin/navigation';
import AdminLayout from '../../layouts/AdminLayout';
import AdminDashboardPage from './AdminDashboardPage';
import AdminLoginPage from './AdminLoginPage';
import ComingSoonPage from './ComingSoonPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import InvoicePage from './orders/InvoicePage';
import OrderDetailPage from './orders/OrderDetailPage';
import OrdersListPage from './orders/OrdersListPage';
import PackingSlipPage from './orders/PackingSlipPage';
import ProductFormPage from './products/ProductFormPage';
import ProductsListPage from './products/ProductsListPage';

// Sections that have their real pages; the rest still show "being built"
const BUILT_SECTIONS = new Set(['orders', 'products']);

// Paths here are relative to /admin
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />

        <Route element={<RequireAdmin />}>
          {/* Print pages: logged in, but without the sidebar */}
          <Route path="orders/:orderNumber/invoice" element={<InvoicePage />} />
          <Route path="orders/:orderNumber/packing-slip" element={<PackingSlipPage />} />

          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />

            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
            <Route path="products" element={<ProductsListPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:productId" element={<ProductFormPage />} />
            {/* Sections not built yet. Each one is swapped for its real page as we build it. */}
            {ADMIN_NAV_ITEMS.filter((item) => item.path && !BUILT_SECTIONS.has(item.path)).map((item) => (
              <Route key={item.path} path={`${item.path}/*`} element={<ComingSoonPage />} />
            ))}
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}