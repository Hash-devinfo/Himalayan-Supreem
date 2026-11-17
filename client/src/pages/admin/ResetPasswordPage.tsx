import { useRef, useState, type AnimationEvent, type FormEvent, type ReactNode, type Ref } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Check, Eye, EyeOff, Link2Off, Loader2, Lock, X } from 'lucide-react';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import FormAlert from '../../components/ui/FormAlert';
import AuthShell, { BackToLoginLink } from '../../features/admin/auth/AuthShell';
import { useAdminAuth } from '../../features/admin/auth/useAdminAuth';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  RESET_LINK_MINUTES,
  RESET_TOKEN_PATTERN,
} from '../../lib/auth';

type Field = 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<Field, string>>;
type FormMessage = { text: string; tone: 'danger' | 'warning' };

function validate(password: string, confirmPassword: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!password) errors.password = 'Enter a new password';
  else if (password.length < PASSWORD_MIN_LENGTH)
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  else if (password.length > PASSWORD_MAX_LENGTH)
    errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;

  if (!confirmPassword) errors.confirmPassword = 'Type the new password again';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

// 0 = empty, 1 = too short, 2 = fair, 3 = good, 4 = strong
function strengthOf(password: string): number {
  if (!password) return 0;
  if (password.length < PASSWORD_MIN_LENGTH) return 1;
  let score = 2;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)) {
    score++;
  }
  return Math.min(score, 4);
}

const STRENGTH_LEVELS = [
  null,
  { label: 'Too short', bar: 'bg-danger', text: 'text-danger' },
  { label: 'Fair', bar: 'bg-warning', text: 'text-warning' },
  { label: 'Good', bar: 'bg-sage', text: 'text-sage' },
  { label: 'Strong', bar: 'bg-sage', text: 'text-sage' },
];

function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 transition-colors ${ok ? 'text-sage' : 'text-muted'}`}>
      {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
      <span className="sr-only">{ok ? 'Done: ' : 'Not yet: '}</span>
      {children}
    </span>
  );
}

interface PasswordFieldProps {
  id: Field;
  label: string;
  value: string;
  error?: string;
  visible: boolean;
  autoFocus?: boolean;
  inputRef: Ref<HTMLInputElement>;
  extraDescribedBy?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onToggleVisible: () => void;
}

function PasswordField({
  id,
  label,
  value,
  error,
  visible,
  autoFocus,
  inputRef,
  extraDescribedBy,
  onChange,
  onBlur,
  onToggleVisible,
}: PasswordFieldProps) {
  const errorId = `${id}-error`;
  const describedBy = [error && errorId, extraDescribedBy].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1">
        <Lock
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
            error ? 'text-danger' : 'text-muted'
          }`}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`input-field mt-0 pl-10 pr-11 ${
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''
          }`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide passwords' : 'Show passwords'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:bg-sage-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-sage"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const navigate = useNavigate();
  const { logout } = useAdminAuth();

  const [linkInvalid, setLinkInvalid] = useState(() => !RESET_TOKEN_PATTERN.test(token));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<Field, boolean>>({ password: false, confirmPassword: false });
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  // Missing, wrong, expired or already-used link
  if (linkInvalid) {
    return (
      <AuthShell footer={<BackToLoginLink />}>
        <div className="card p-6 md:p-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <Link2Off className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-medium">This reset link doesn't work</h1>
          <p className="mt-2 text-sm text-muted">
            Reset links work only once, for {RESET_LINK_MINUTES} minutes. Request a new link to continue.
          </p>
          <Link to="/admin/forgot-password" className="btn-primary mt-6 w-full">
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  const clientErrors = validate(password, confirmPassword);
  const errorFor = (field: Field) =>
    (touched[field] ? clientErrors[field] : undefined) ?? serverErrors[field];
  const passwordError = errorFor('password');
  const confirmError = errorFor('confirmPassword');

  const score = strengthOf(password);
  const level = STRENGTH_LEVELS[score];
  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  const matches = confirmPassword.length > 0 && password === confirmPassword;

  function clearErrorsFor(field: Field) {
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    if (formMessage?.tone === 'danger') setFormMessage(null);
  }

  function stopShake(e: AnimationEvent<HTMLFormElement>) {
    if (e.target === e.currentTarget) setShake(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setTouched({ password: true, confirmPassword: true });
    const errors = validate(password, confirmPassword);
    if (errors.password || errors.confirmPassword) {
      setShake(true);
      (errors.password ? passwordRef : confirmRef).current?.focus();
      return;
    }

    setFormMessage(null);
    setServerErrors({});
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword(token, password, confirmPassword);
      // The server logged out every device; make this browser show the login screen too
      await logout().catch(() => undefined);
      navigate('/admin/login', { replace: true, state: { notice: res.message } });
    } catch (err) {
      setShake(true);
      if (err instanceof ApiError) {
        const linkProblem =
          err.details.some((d) => d.field === 'token') || (err.status === 400 && err.details.length === 0);
        if (linkProblem) {
          setLinkInvalid(true);
          return;
        }
        setFormMessage({ text: err.message, tone: err.status === 429 ? 'warning' : 'danger' });
        setServerErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])) as FieldErrors);
      } else {
        setFormMessage({
          text: 'Could not reach the server. Check your connection and try again.',
          tone: 'danger',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell footer={<BackToLoginLink />}>
      <form
        onSubmit={handleSubmit}
        noValidate
        onAnimationEnd={stopShake}
        className={`card p-6 md:p-8 ${shake ? 'motion-safe:animate-shake' : ''}`}
      >
        <h1 className="text-xl font-medium">Choose a new password</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          After this, every device is logged out and you sign in with the new password.
        </p>

        {formMessage && <FormAlert tone={formMessage.tone}>{formMessage.text}</FormAlert>}

        <PasswordField
          id="password"
          label="New password"
          value={password}
          error={passwordError}
          visible={visible}
          autoFocus
          inputRef={passwordRef}
          extraDescribedBy="password-rules"
          onChange={(value) => {
            setPassword(value);
            clearErrorsFor('password');
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          onToggleVisible={() => setVisible((v) => !v)}
        />

        {/* Strength meter and rule */}
        <div id="password-rules" className="mt-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  level && score >= step ? level.bar : 'bg-line'
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <Rule ok={longEnough}>At least {PASSWORD_MIN_LENGTH} characters</Rule>
            {level && <span className={level.text}>{level.label}</span>}
          </div>
        </div>

        <div className="mt-5">
          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            value={confirmPassword}
            error={confirmError}
            visible={visible}
            inputRef={confirmRef}
            onChange={(value) => {
              setConfirmPassword(value);
              clearErrorsFor('confirmPassword');
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
            onToggleVisible={() => setVisible((v) => !v)}
          />
          {!confirmError && confirmPassword && (
            <p className="mt-2 text-xs">
              <Rule ok={matches}>Passwords match</Rule>
            </p>
          )}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-7 w-full gap-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Change password'
          )}
        </button>
      </form>
    </AuthShell>
  );
}