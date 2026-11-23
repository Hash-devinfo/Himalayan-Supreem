import { useLocation } from 'react-router';
import { Construction } from 'lucide-react';
import { findNavItem } from '../../features/admin/navigation';

export default function ComingSoonPage() {
  const item = findNavItem(useLocation().pathname);
  const Icon = item?.icon ?? Construction;

  return (
    <section className="card mx-auto mt-8 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-sage">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-medium">{item?.label ?? 'Coming soon'}</h1>
      {item && <p className="mt-2 text-sm text-muted">{item.description}</p>}
      <p className="mt-4 text-xs text-muted">This section is being built.</p>
    </section>
  );
}
