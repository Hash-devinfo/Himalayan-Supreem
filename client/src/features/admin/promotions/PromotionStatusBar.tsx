import { useState } from 'react';
import { CircleStop, Loader2, Pause, Play } from 'lucide-react';
import { promotionsApi, type Promotion } from '../../../api/promotions';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { errorText, stateLabel } from './promotionText';
import { usePromotionMutation } from './queries';

interface StatusBarProps {
  promotion: Promotion;
  onDone: (message: string) => void;
}

function EndConfirm({ promotion, onClose, onDone }: StatusBarProps & { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const end = usePromotionMutation(() => promotionsApi.end(promotion.id));

  return (
    <div>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">
        Customers stop getting it straight away. Ending is final: an ended promotion can't be restarted or edited. Orders that already
        used it keep their discount.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button
          type="button"
          disabled={end.isPending}
          onClick={() =>
            end.mutate(undefined, {
              onSuccess: () => onDone(`"${promotion.name}" has ended.`),
              onError: (err) => setError(errorText(err)),
            })
          }
          className="btn-danger gap-2"
        >
          {end.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          End promotion
        </button>
      </div>
    </div>
  );
}

// Pause / resume (one click) and end (asks first)
export default function PromotionStatusBar({ promotion, onDone }: StatusBarProps) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = usePromotionMutation(() =>
    promotion.status === 'paused' ? promotionsApi.resume(promotion.id) : promotionsApi.pause(promotion.id),
  );

  if (promotion.status === 'ended') return null;
  const paused = promotion.status === 'paused';

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="mr-auto min-w-0">
        <p className="text-sm font-medium">{paused ? 'Paused: customers are not getting this' : promotion.live ? 'Running now' : stateLabel(promotion.state)}</p>
        <p className="mt-0.5 text-xs text-muted">
          {paused ? 'Resume it to turn it back on. Its dates and limits still apply.' : 'Pause it to stop it for a while without losing the setup.'}
        </p>
      </div>
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() => {
          setError(null);
          toggle.mutate(undefined, {
            onSuccess: () => onDone(paused ? `"${promotion.name}" is on again.` : `"${promotion.name}" is paused.`),
            onError: (err) => setError(errorText(err)),
          });
        }}
        className={`${paused ? 'btn-primary' : 'btn-secondary'} w-full gap-2 sm:w-auto`}
      >
        {toggle.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : paused ? (
          <Play className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Pause className="h-4 w-4" aria-hidden="true" />
        )}
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" onClick={() => setConfirmEnd(true)} className="btn-secondary w-full gap-2 text-danger sm:w-auto">
        <CircleStop className="h-4 w-4" aria-hidden="true" />
        End
      </button>
      {error && (
        <FormAlert tone="danger" className="w-full">
          {error}
        </FormAlert>
      )}
      {confirmEnd && (
        <Modal open onClose={() => setConfirmEnd(false)} title={`End "${promotion.name}"?`}>
          <EndConfirm
            promotion={promotion}
            onClose={() => setConfirmEnd(false)}
            onDone={(message) => {
              setConfirmEnd(false);
              onDone(message);
            }}
          />
        </Modal>
      )}
    </div>
  );
}