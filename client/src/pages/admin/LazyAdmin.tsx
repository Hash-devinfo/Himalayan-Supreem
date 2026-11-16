import { lazy, Suspense } from 'react';
import PageLoader from '../../components/ui/PageLoader';

const AdminApp = lazy(() => import('./AdminApp'));

export function LazyAdminApp() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminApp />
    </Suspense>
  );
}