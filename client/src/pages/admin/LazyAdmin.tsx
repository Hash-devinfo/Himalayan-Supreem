import { lazy, Suspense } from 'react';
import PageLoader from '../../components/ui/PageLoader';

const AdminLayout = lazy(() => import('../../layouts/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./AdminDashboardPage'));

export function LazyAdminLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout />
    </Suspense>
  );
}

export function LazyAdminDashboardPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminDashboardPage />
    </Suspense>
  );
}