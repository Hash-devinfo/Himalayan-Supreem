import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CircleCheck, ExternalLink, Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { pagesAdminApi, type PolicyPage } from '../../../api/pages';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import PlainTextPage from '../../../components/ui/PlainTextPage';
import Skeleton from '../../../components/ui/Skeleton';
import { Panel, PanelError } from '../../../features/admin/dashboard/DashboardPanel';
import { PAGE_STATUS } from '../../../features/admin/policies/pageStatus';
import { usePageMutation, usePolicyPage } from '../../../features/admin/policies/queries';
import { formatDateTime } from '../../../lib/format';

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');
const HTML_TAG = /<\s*\/?\s*[a-z][^>]*>/i; // same check as the server
const MAX_LENGTH = 50_000;

function BackLink() {
  return (
    <Link to="/admin/pages" className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All policy pages
    </Link>
  );
}

function ApproveDialog({ page, onClose, onDone }: { page: PolicyPage; onClose: () => void; onDone: (message: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const approve = usePageMutation(() => pagesAdminApi.approve(page.slug));

  return (
    <Modal open onClose={onClose} title={`Approve "${page.title}"?`}>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        You confirm this is your final wording for customers. The "pending review" notice disappears from the page. Editing it again
        later sends it back to review.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button
          type="button"
          disabled={approve.isPending}
          onClick={() =>
            approve.mutate(undefined, {
              onSuccess: () => onDone(`"${page.title}" is approved.`),
              onError: (err) => setError(errorText(err)),
            })
          }
          className="btn-primary gap-2"
        >
          {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Approve
        </button>
      </div>
    </Modal>
  );
}

function PageEditor({ page, mustCover, onNotice }: { page: PolicyPage; mustCover: string[]; onNotice: (message: string) => void }) {
  // A placeholder starts empty, so its "PLACEHOLDER" text is never kept by accident
  const startContent = page.status === 'placeholder' ? '' : page.content;
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(startContent);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>({});
  const [approving, setApproving] = useState(false);
  const save = usePageMutation((body: { title?: string; content?: string }) => pagesAdminApi.update(page.slug, body));

  const dirty = title.trim() !== page.title || content.trim() !== startContent.trim();
  const status = PAGE_STATUS[page.status];

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errors: { title?: string; content?: string } = {};
    if (title.trim().length < 3) errors.title = 'Enter a title (at least 3 characters)';
    if (content.trim().length < 20) errors.content = 'Write the page (at least 20 characters)';
    else if (HTML_TAG.test(content)) errors.content = 'Use plain text (# for headings, - for lists), not HTML tags like <p>';
    else if (content.length > MAX_LENGTH) errors.content = 'The page is too long (50,000 characters at most)';
    setFieldErrors(errors);
    if (errors.title || errors.content) return;

    save.mutate(
      { title: title.trim(), content: content.trim() },
      {
        onSuccess: () => onNotice('Saved. It now needs your review: read it once more, then click Approve.'),
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
      <form onSubmit={handleSubmit} noValidate className="space-y-4 lg:col-span-2">
        {error && (
          <FormAlert tone="danger" className="">
            {error}
          </FormAlert>
        )}

        <div className="card p-5">
          <label htmlFor="page-title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="page-title"
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              setFieldErrors((prev) => ({ ...prev, title: undefined }));
            }}
            className={`input-field ${fieldErrors.title ? 'border-danger' : ''}`}
          />
          {fieldErrors.title && <p className="mt-1.5 text-xs text-danger">{fieldErrors.title}</p>}

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex gap-1" role="tablist" aria-label="Write or preview">
              {(['write', 'preview'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    tab === t ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t === 'write' ? 'Write' : 'Preview'}
                </button>
              ))}
            </div>
            <span className="text-xs tabular-nums text-muted">{content.length.toLocaleString()} / 50,000</span>
          </div>

          {tab === 'write' ? (
            <>
              <label htmlFor="page-content" className="sr-only">
                Page text
              </label>
              <textarea
                id="page-content"
                rows={20}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, content: undefined }));
                }}
                placeholder={'# Heading\n\nA paragraph of text.\n\n- A list item\n- Another item'}
                className={`input-field resize-y font-mono text-sm leading-relaxed ${fieldErrors.content ? 'border-danger' : ''}`}
              />
              <p className="mt-1.5 text-xs text-muted">
                Plain text. Start a line with <code># </code> for a heading, <code>## </code> for a smaller heading,{' '}
                <code>- </code> for a list item. Leave a blank line between paragraphs.
              </p>
            </>
          ) : (
            <div className="mt-3 min-h-64 rounded-xl border border-line bg-canvas px-5 py-3">
              {content.trim() ? <PlainTextPage text={content} /> : <p className="py-6 text-sm text-muted">Nothing written yet.</p>}
            </div>
          )}
          {fieldErrors.content && <p className="mt-1.5 text-xs text-danger">{fieldErrors.content}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {page.status === 'needs_review' && (
            <button
              type="button"
              onClick={() => setApproving(true)}
              disabled={dirty}
              title={dirty ? 'Save your changes first' : undefined}
              className="btn-secondary gap-2"
            >
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
              Approve
            </button>
          )}
          <button type="submit" disabled={save.isPending || !dirty} className="btn-primary gap-2">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save
          </button>
        </div>
        {page.status === 'needs_review' && dirty && (
          <p className="text-right text-xs text-muted">Save your changes before approving.</p>
        )}
      </form>

      <div className="space-y-6">
        <Panel title="Status">
          <div className="space-y-2 px-4 py-3 text-sm">
            <Badge tone={status.tone}>{status.label}</Badge>
            <p className="text-xs text-muted">{status.hint}</p>
            <p className="text-xs text-muted">
              Last change {formatDateTime(page.updatedAt)}
              {page.updatedBy?.name ? ` by ${page.updatedBy.name}` : ''}
            </p>
            {page.status === 'approved' && page.approvedAt && (
              <p className="text-xs text-muted">
                Approved {formatDateTime(page.approvedAt)}
                {page.approvedBy?.name ? ` by ${page.approvedBy.name}` : ''}
              </p>
            )}
            <a
              href={`/pages/${page.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-xs text-sage underline-offset-4 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View on the store (once the storefront is built)
            </a>
          </div>
        </Panel>

        <Panel title="What this page should cover" subtitle="From your requirements. A guide for you, not wording for customers.">
          <ul className="list-disc space-y-1.5 py-3 pr-4 pl-8 text-sm">
            {mustCover.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
      </div>

      {approving && (
        <ApproveDialog
          page={page}
          onClose={() => setApproving(false)}
          onDone={(message) => {
            setApproving(false);
            onNotice(message);
          }}
        />
      )}
    </div>
  );
}

// /admin/pages/:slug
export default function PolicyPageEditPage() {
  const { slug = '' } = useParams();
  const query = usePolicyPage(slug);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <BackLink />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <BackLink />
        <div className="card">
          <PanelError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      </div>
    );
  }

  const { page, mustCover } = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackLink />
      <header>
        <h1 className="text-2xl font-medium">{page.title}</h1>
        <p className="mt-1 text-sm text-muted">Write it in your own words. Have it checked by a lawyer or advisor before launch.</p>
      </header>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      {/* Keyed so the editor starts from the saved text after each save or approval */}
      <PageEditor key={`${page.updatedAt}-${page.status}`} page={page} mustCover={mustCover} onNotice={setNotice} />
    </div>
  );
}