import { createBrowserRouter } from 'react-router';
import StoreLayout from './layouts/StoreLayout';
import HomePage from './pages/storefront/HomePage';
import NotFoundPage from './pages/storefront/NotFoundPage';
import { LazyAdminApp } from './pages/admin/LazyAdmin';

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
    // "/*" lets AdminApp handle everything under /admin with its own <Routes>
    path: '/admin/*',
    element: <LazyAdminApp />,
  },
]);