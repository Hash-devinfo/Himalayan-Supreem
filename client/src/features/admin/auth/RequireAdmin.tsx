import { Navigate, Outlet, useLocation } from 'react-router';
import PageLoader from '../../../components/ui/PageLoader';
import { useAdminAuth } from './useAdminAuth';

export default function RequireAdmin() {
  const { status } = useAdminAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;

  if (status === 'guest') {
    // Remember where the admin was going, so login can send them back there
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}