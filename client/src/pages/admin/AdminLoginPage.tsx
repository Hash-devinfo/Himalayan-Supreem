import { useRef, useState, type AnimationEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { ApiError } from '../../api/client';
import FormAlert from '../../components/ui/FormAlert';
import PageLoader from '../../components/ui/PageLoader';
import AuthShell from '../../features/admin/auth/AuthShell';
import { useAdminAuth } from '../../features/admin/auth/useAdminAuth';
import { EMAIL_PATTERN } from '../../lib/auth';

type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;
type FormMessage = { text: string; tone: 'danger' | 'warning' };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Enter your email address';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Enter your password';
  return errors;
}

export default function AdminLoginPage() {
  const { status, login } = useAdminAuth();
  const location = useLocation();
  const navState = location.state as { from?: string; notice?: string } | null;
  const from = navState?.from ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<Field, boolean>>({ email: false, password: false });
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [notice, setNotice] = useState<string | null>(navState?.notice ?? null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={from} replace />;

  const clientErrors = validate(email, password);
  const errorFor = (field: Field) =>
    (touched[field] ? clientErrors[field] : undefined) ?? serverErrors[field];

  function clearErrorsFor(field: Field) {
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    if (formMessage?.tone === 'danger') setFormMessage(null);
  }

  function checkCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'));
  }

  function stopShake(e: AnimationEvent<HTMLFormElement>) {
    if (e.target === e.currentTarget) setShake(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setNotice(null);
    setTouched({ email: true, password: true });
    const errors = validate(email, password);
    if (errors.email || errors.password) {
      setShake(true);
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setFormMessage(null);
    setServerErrors({});
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setShake(true);
      setPassword('');
      setTouched((prev) => ({ ...prev, password: false }));

      if (err instanceof ApiError) {
        const lockedOut = err.status === 423 || err.status === 429;
        setFormMessage({ text: err.message, tone: lockedOut ? 'warning' : 'danger' });
        setServerErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])) as FieldErrors);
      } else {
        setFormMessage({
          text: 'Could not reach the server. Check your connection and try again.',
          tone: 'danger',
        });
      }
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  const emailError = errorFor('email');
  const passwordError = errorFor('password');

  const inputClass = (hasError: boolean) =>
    `input-field mt-0 pl-10 ${hasError ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`;

  return (
    <AuthShell>
      <form
        onSubmit={handleSubmit}
        noValidate
        onAnimationEnd={stopShake}
        className={`card p-6 md:p-8 ${shake ? 'motion-safe:animate-shake' : ''}`}
      >
        <h1 className="text-xl font-medium">Welcome back</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Sign in to manage the store.</p>

        {notice && <FormAlert tone="success">{notice}</FormAlert>}
        {formMessage && <FormAlert tone={formMessage.tone}>{formMessage.text}</FormAlert>}

        {/* Email */}
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <div className="relative mt-1">
          <Mail
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              emailError ? 'text-danger' : 'text-muted'
            }`}
            aria-hidden="true"
          />
          <input
            ref={emailRef}
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearErrorsFor('email');
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'email-error' : undefined}
            className={inputClass(!!emailError)}
          />
        </div>
        {emailError && (
          <p id="email-error" className="mt-1.5 text-xs text-danger">
            {emailError}
          </p>
        )}

        {/* Password */}
        <div className="mt-5 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <Link
            to="/admin/forgot-password"
            className="text-xs text-sage underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative mt-1">
          <Lock
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              passwordError ? 'text-danger' : 'text-muted'
            }`}
            aria-hidden="true"
          />
          <input
            ref={passwordRef}
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearErrorsFor('password');
            }}
            onKeyDown={checkCapsLock}
            onKeyUp={checkCapsLock}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, password: true }));
              setCapsLock(false);
            }}
            aria-invalid={!!passwordError}
            aria-describedby={
              [passwordError && 'password-error', capsLock && 'caps-warning'].filter(Boolean).join(' ') ||
              undefined
            }
            className={`${inputClass(!!passwordError)} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:bg-sage-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-sage"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {passwordError && (
          <p id="password-error" className="mt-1.5 text-xs text-danger">
            {passwordError}
          </p>
        )}
        {capsLock && (
          <p id="caps-warning" className="mt-1.5 text-xs text-warning">
            Caps Lock is on
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary group mt-7 w-full gap-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Logging in…
            </>
          ) : (
            <>
              Log in
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}