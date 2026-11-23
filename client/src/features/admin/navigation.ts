import {
  Bell,
  Boxes,
  ChartLine,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Truck,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  path: string; // relative to /admin ('' = dashboard)
  icon: LucideIcon;
  description: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', path: '', icon: LayoutDashboard, description: 'Your store at a glance' }],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Orders', path: 'orders', icon: ShoppingBag, description: 'Confirm, pack, ship and track orders' },
      { label: 'Customers', path: 'customers', icon: Users, description: 'Order history, risk and blocked numbers' },
      { label: 'Refunds', path: 'refunds', icon: Undo2, description: 'Refunds for damaged or incorrect products' },
      { label: 'Reviews', path: 'reviews', icon: Star, description: 'Publish, hide or remove customer reviews' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', path: 'products', icon: Package, description: 'Products, variants, prices and photos' },
      { label: 'Categories', path: 'categories', icon: FolderTree, description: 'Organise products into categories' },
      { label: 'Inventory', path: 'inventory', icon: Boxes, description: 'Batches, expiry dates and stock movements' },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', path: 'reports', icon: ChartLine, description: 'Sales, profit, stock, delivery and analytics' }],
  },
  {
    label: 'Store',
    items: [
      { label: 'Delivery', path: 'delivery', icon: Truck, description: 'Zones, cities and delivery charges' },
      { label: 'Notifications', path: 'notifications', icon: Bell, description: 'Message templates and sending log' },
      { label: 'Policy pages', path: 'pages', icon: FileText, description: 'Refund, privacy, delivery and terms pages' },
      { label: 'Settings', path: 'settings', icon: Settings, description: 'Store details and business rules' },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((group) => group.items);

export const adminHref = (path: string) => (path ? `/admin/${path}` : '/admin');

// Finds the section for a URL, e.g. /admin/orders/123 -> Orders
export function findNavItem(pathname: string): AdminNavItem | undefined {
  const section = pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? '';
  return ADMIN_NAV_ITEMS.find((item) => item.path === section);
}