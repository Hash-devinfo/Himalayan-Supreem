import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ApiError } from '../../api/client';
import PageLoader from '../../components/ui/PageLoader';
import { useAdminAuth } from '../../features/admin/auth/useAdminAuth';

export default function AdminLoginPage() {
  const { status, login } = useAdminAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <PageLoader />;
  // Already logged in (or just logged in): go to where they were heading
  if (status === 'authenticated') return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

    const inputClass = (field: string) =>
    `input-field ${fieldErrors[field] ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`;
   return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-6 md:p-8">
        <h1 className="mb-1 text-xl font-medium">Admin login</h1>
        <p className="mb-6 text-sm text-muted">Sign in to manage the store.</p>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          className={inputClass('email')}
        />
        {fieldErrors.email && (
          <p id="email-error" className="mt-1 text-xs text-danger">
            {fieldErrors.email}
          </p>
        )}

        <label htmlFor="password" className="mt-4 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          className={inputClass('password')}
        />
        {fieldErrors.password && (
          <p id="password-error" className="mt-1 text-xs text-danger">
            {fieldErrors.password}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}