import { Navigate, Route, Routes } from "react-router";
import AdminAuthProvider from "../../features/admin/auth/AdminAuthProvider";
import RequireAdmin from "../../features/admin/auth/RequireAdmin";
import AdminLayout from "../../layouts/AdminLayout";
import AdminLoginPage from "./AdminLoginPage";
import AdminDashboardPage from "./AdminDashboardPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";
import OrderDetailPage from "./orders/OrderDetailPage";

// Paths here are relative to /admin
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
            {/* New admin pages go here */}
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
