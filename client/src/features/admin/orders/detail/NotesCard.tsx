import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { ApiError } from '../../../../api/client';
import { ordersApi, type OrderDetail } from '../../../../api/orders';
import FormAlert from '../../../../components/ui/FormAlert';
import { Panel } from '../../dashboard/DashboardPanel';
import { useOrderMutation } from '../actions/useOrderMutation';

const MAX = 2000;

export default function NotesCard({ order }: { order: OrderDetail }) {
  const saved = order.adminNotes ?? '';
  const [text, setText] = useState(saved);
  const mutation = useOrderMutation((notes: string) => ordersApi.updateNotes(order.orderNumber, notes));
  const dirty = text.trim() !== saved;

  return (
    <Panel title="Your notes" subtitle="Only you see these. Customers never do.">
      <div className="p-4">
        {mutation.isError && (
          <FormAlert tone="danger">
            {mutation.error instanceof ApiError ? mutation.error.message : 'Could not save. Try again.'}
          </FormAlert>
        )}
        <label htmlFor="order-notes" className="sr-only">
          Your notes
        </label>
        <textarea
          id="order-notes"
          rows={4}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="For example: prefers calls after 5 pm, leave the parcel at the shop next door"
          className="input-field mt-0 resize-y"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="tabular-nums text-muted">
            {text.length}/{MAX}
          </span>
          <div className="flex items-center gap-3">
            {mutation.isSuccess && !dirty && (
              <span className="inline-flex items-center gap-1 text-sage">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => mutation.mutate(text.trim())}
              disabled={!dirty || mutation.isPending}
              className="btn-secondary gap-1.5 px-3 py-1.5"
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Save notes
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}