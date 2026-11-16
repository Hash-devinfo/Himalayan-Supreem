import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { ApiError } from '../../api/client';
import PageLoader from '../../components/ui/PageLoader';
import { useAdminAuth } from '../../features/admin/auth/useAdminAuth';
import { STORE_NAME } from '../../lib/store';


type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;
type FormMessage = { text: string; tone: 'danger' | 'warning' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<Field, boolean>>({ email: false, password: false });
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={from} replace />;

  // Client checks show only after a field is touched; server errors always show
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

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
    <main className="grid min-h-screen md:grid-cols-2">
      {/* Left panel: desktop only */}
      <section className="hidden flex-col justify-between bg-sage-soft p-10 md:flex">
                <p className="text-lg font-medium tracking-tight">{STORE_NAME}</p>
        <div>
          <p className="text-3xl font-medium leading-tight">
            Orders, stock and deliveries,
            <br />
            all in one place.
          </p>
          <p className="mt-3 text-sm text-muted">Admin area. Authorised access only.</p>
        </div>
                <p className="text-xs text-muted">© {new Date().getFullYear()} {STORE_NAME}</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm motion-safe:animate-fade-up">
                    <p className="mb-6 text-center text-lg font-medium tracking-tight md:hidden">{STORE_NAME}</p>

          <form
            onSubmit={handleSubmit}
            noValidate
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setShake(false);
            }}
            className={`card p-6 md:p-8 ${shake ? 'motion-safe:animate-shake' : ''}`}
          >
            <h1 className="text-xl font-medium">Welcome back</h1>
            <p className="mb-6 mt-1 text-sm text-muted">Sign in to manage the store.</p>

            {formMessage && (
              <div
                role="alert"
                className={`mb-5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                  formMessage.tone === 'warning'
                    ? 'bg-warning-soft text-warning'
                    : 'bg-danger-soft text-danger'
                }`}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formMessage.text}</span>
              </div>
            )}

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
            <label htmlFor="password" className="mt-5 block text-sm font-medium">
              Password
            </label>
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

          <p className="mt-6 text-center text-xs text-muted">
            Forgot your password? Ask the store owner to reset it.
          </p>
        </div>
      </section>
    </main>
  );
}