import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { productsAdminApi, type AdminProduct, type ProductStatus } from '../../../api/catalog';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { Panel } from '../dashboard/DashboardPanel';
import { PRODUCT_STATUS_HELP, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from './productStatus';
import { PRODUCTS_KEY } from './queries';

export default function ProductStatusPanel({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [problems, setProblems] = useState<{ message: string; details: string[] } | null>(null);

  const mutation = useMutation({
    mutationFn: (status: ProductStatus) => productsAdminApi.changeStatus(product._id, status),
    onSuccess: () => {
      setProblems(null);
      setConfirmArchive(false);
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (err) => {
      setConfirmArchive(false);
      setProblems(
        err instanceof ApiError
          ? { message: err.message, details: err.details.map((d) => d.message) }
          : { message: 'Could not reach the server. Try again.', details: [] },
      );
    },
  });

  const change = (status: ProductStatus) => {
    setProblems(null);
    mutation.mutate(status);
  };
  const busy = mutation.isPending;
  const s = product.status;

  return (
    <Panel title="Status">
      <div className="space-y-4 p-4">
        <div>
          <Badge tone={PRODUCT_STATUS_TONES[s]}>{PRODUCT_STATUS_LABELS[s]}</Badge>
          <p className="mt-2 text-sm text-muted">{PRODUCT_STATUS_HELP[s]}</p>
        </div>

        {problems && (
          <FormAlert tone="danger" className="">
            <span className="block">{problems.message}</span>
            {problems.details.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {problems.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </FormAlert>
        )}

        <div className="flex flex-col gap-2">
          {(s === 'draft' || s === 'unpublished') && (
            <button type="button" onClick={() => change('published')} disabled={busy} className="btn-primary gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              Publish
            </button>
          )}
          {s === 'published' && (
            <button type="button" onClick={() => change('unpublished')} disabled={busy} className="btn-secondary gap-2">
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              Unpublish
            </button>
          )}
          {s !== 'archived' && (
            <button type="button" onClick={() => setConfirmArchive(true)} disabled={busy} className="btn-secondary gap-2 text-danger">
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archive
            </button>
          )}
          {s === 'archived' && (
            <button type="button" onClick={() => change('draft')} disabled={busy} className="btn-primary gap-2">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Restore as draft
            </button>
          )}
        </div>
      </div>

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this product?"
        description={product.name}
      >
        <p className="text-sm text-muted">
          It disappears from the store and can't be edited until you restore it as a draft. Past orders keep their details.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirmArchive(false)} className="btn-secondary">
            Keep it
          </button>
          <button type="button" onClick={() => change('archived')} disabled={busy} className="btn-danger gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Archive product
          </button>
        </div>
      </Modal>
    </Panel>
  );
}