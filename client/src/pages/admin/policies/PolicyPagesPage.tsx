import { Link } from 'react-router';
import { ChevronRight, FileText } from 'lucide-react';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import { EmptyState, ListSkeleton, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { PAGE_STATUS } from '../../../features/admin/policies/pageStatus';
import { usePolicyPages } from '../../../features/admin/policies/queries';
import { formatDate } from '../../../lib/format';

export default function PolicyPagesPage() {
  const pages = usePolicyPages();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-medium">Policy pages</h1>
        <p className="mt-1 text-sm text-muted">
          The pages customers see in the footer and at checkout. You write the wording; nothing here is legal advice.
        </p>
      </header>

      {pages.data && !pages.data.allApproved && (
        <FormAlert tone="warning" className="">
          Before launch, every page must be written and approved by you (ideally after a lawyer or advisor checks it). Until then,
          customers see a "pending review" notice on that page.
        </FormAlert>
      )}

      <section className="card overflow-hidden" aria-label="Policy pages">
        {pages.isPending ? (
          <ListSkeleton rows={5} />
        ) : pages.isError ? (
          <PanelError error={pages.error} onRetry={() => void pages.refetch()} />
        ) : pages.data.pages.length === 0 ? (
          <EmptyState icon={FileText} title="No pages" text="The server creates the policy pages automatically." />
        ) : (
          <ul className="divide-y divide-line">
            {pages.data.pages.map((p) => {
              const status = PAGE_STATUS[p.status];
              return (
                <li key={p.slug}>
                  <Link to={`/admin/pages/${p.slug}`} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-canvas">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {p.title}
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {p.status === 'approved' && p.approvedAt ? `Approved ${formatDate(p.approvedAt)}` : status.hint}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}