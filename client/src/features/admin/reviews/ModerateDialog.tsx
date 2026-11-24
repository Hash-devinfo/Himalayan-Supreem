import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import type { AdminReview } from '../../../api/reviews';
import FormAlert from '../../../components/ui/FormAlert';
import Modal from '../../../components/ui/Modal';
import { useModerateReview } from './queries';

type Action = 'hidden' | 'removed';

const COPY: Record<Action, { title: string; text: string; button: string }> = {
  hidden: {
    title: 'Hide this review?',
    text: "It disappears from the website, but you can publish it again later. Use this for a review you're not sure about.",
    button: 'Hide review',
  },
  removed: {
    title: 'Remove this review?',
    text: "It disappears from the website. Use this for spam, abuse, personal details or a review that isn't about the product. You can still publish it again if you change your mind.",
    button: 'Remove review',
  },
};

interface FormProps {
  review: AdminReview;
  action: Action;
  onClose: () => void;
  onDone: (message: string) => void;
}

function ModerateForm({ review, action, onClose, onDone }: FormProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useModerateReview();
  const copy = COPY[action];

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (note.trim().length < 3) {
      setFieldError(`Write why the review is ${action}`);
      return;
    }
    mutation.mutate(
      { id: review.id, status: action, note: note.trim() },
      {
        onSuccess: () => onDone(`${review.displayName}'s review is ${action}.`),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.'),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <p className="text-sm text-muted">{copy.text}</p>
      <label htmlFor="moderation-note" className="mt-4 block text-sm font-medium">
        Reason <span className="font-normal text-muted">(only you see this)</span>
      </label>
      <textarea
        id="moderation-note"
        rows={3}
        maxLength={500}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setFieldError(undefined);
        }}
        placeholder={action === 'removed' ? 'Contains a phone number, spam link…' : 'Checking with the customer first…'}
        className={`input-field resize-y ${fieldError ? 'border-danger' : ''}`}
      />
      {fieldError && <p className="mt-1.5 text-xs text-danger">{fieldError}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending} className={`${action === 'removed' ? 'btn-danger' : 'btn-primary'} gap-2`}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {copy.button}
        </button>
      </div>
    </form>
  );
}

export default function ModerateDialog({ open, ...props }: FormProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title={COPY[props.action].title}>
      <ModerateForm {...props} />
    </Modal>
  );
}