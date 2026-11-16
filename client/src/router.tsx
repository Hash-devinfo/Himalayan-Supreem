import { createBrowserRouter } from 'react-router';
import StoreLayout from './layouts/StoreLayout';
import HomePage from './pages/storefront/HomePage';
import NotFoundPage from './pages/storefront/NotFoundPage';
import { LazyAdminLayout, LazyAdminDashboardPage } from './pages/admin/LazyAdmin';

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
    element: <LazyAdminLayout />,
    children: [{ index: true, element: <LazyAdminDashboardPage /> }],
  },
]);