import { useEffect, useRef, useState, type AnimationEvent, type FormEvent } from 'react';
import { Loader2, Mail, MailCheck } from 'lucide-react';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import FormAlert from '../../components/ui/FormAlert';
import AuthShell, { BackToLoginLink } from '../../features/admin/auth/AuthShell';
import { EMAIL_PATTERN, RESET_LINK_MINUTES } from '../../lib/auth';

const RESEND_SECONDS = 60;

type FormMessage = { text: string; tone: 'danger' | 'warning' };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverEmailError, setServerEmailError] = useState<string | undefined>();
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [shake, setShake] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // "Send again" countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const clientError = !email.trim()
    ? 'Enter your email address'
    : !EMAIL_PATTERN.test(email.trim())
      ? 'Enter a valid email address'
      : undefined;
  const emailError = (touched ? clientError : undefined) ?? serverEmailError;

  function stopShake(e: AnimationEvent<HTMLElement>) {
    if (e.target === e.currentTarget) setShake(false);
  }

  async function sendLink() {
    setFormMessage(null);
    setServerEmailError(undefined);
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setSentMessage(res.message);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setShake(true);
      if (err instanceof ApiError) {
        setFormMessage({ text: err.message, tone: err.status === 429 ? 'warning' : 'danger' });
        setServerEmailError(err.details.find((d) => d.field === 'email')?.message);
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setTouched(true);
    if (clientError) {
      setShake(true);
      emailRef.current?.focus();
      return;
    }
    await sendLink();
  }

  const cardClass = `card p-6 md:p-8 ${shake ? 'motion-safe:animate-shake' : ''}`;

  // After sending: "Check your email"
  if (sentMessage) {
    return (
      <AuthShell footer={<BackToLoginLink />}>
        <div className={cardClass} onAnimationEnd={stopShake}>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-sage-soft text-sage">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-medium">Check your email</h1>
          <p className="mt-2 text-sm text-muted">{sentMessage}</p>
          <p className="mt-2 text-sm text-muted">
            Sent to <span className="font-medium text-ink">{email.trim()}</span>. Check your spam folder too.
          </p>

          {formMessage && (
            <FormAlert tone={formMessage.tone} className="mt-5">
              {formMessage.text}
            </FormAlert>
          )}

          <button
            type="button"
            onClick={() => void sendLink()}
            disabled={submitting || cooldown > 0}
            className="btn-secondary mt-6 w-full gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : cooldown > 0 ? (
              `Send again in ${cooldown}s`
            ) : (
              'Send again'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentMessage(null);
              setFormMessage(null);
              setCooldown(0);
            }}
            className="mt-3 w-full text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Use a different email
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell footer={<BackToLoginLink />}>
      <form onSubmit={handleSubmit} noValidate onAnimationEnd={stopShake} className={cardClass}>
        <h1 className="text-xl font-medium">Forgot your password?</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Enter your admin email and we'll send you a link to choose a new password. The link works for{' '}
          {RESET_LINK_MINUTES} minutes.
        </p>

        {formMessage && <FormAlert tone={formMessage.tone}>{formMessage.text}</FormAlert>}

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
              setServerEmailError(undefined);
              if (formMessage?.tone === 'danger') setFormMessage(null);
            }}
            onBlur={() => setTouched(true)}
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'email-error' : undefined}
            className={`input-field mt-0 pl-10 ${
              emailError ? 'border-danger focus:border-danger focus:ring-danger/20' : ''
            }`}
          />
        </div>
        {emailError && (
          <p id="email-error" className="mt-1.5 text-xs text-danger">
            {emailError}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary mt-7 w-full gap-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>
    </AuthShell>
  );
}