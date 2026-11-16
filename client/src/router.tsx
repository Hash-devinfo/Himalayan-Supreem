import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import StoreLayout from './layouts/StoreLayout';
import HomePage from './pages/storefront/HomePage';
import NotFoundPage from './pages/storefront/NotFoundPage';
import PageLoader from './components/ui/PageLoader';

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));

const withSuspense = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <StoreLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: withSuspense(<AdminLayout />),
    children: [{ index: true, element: withSuspense(<AdminDashboardPage />) }],
  },
]);