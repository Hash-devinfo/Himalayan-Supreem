import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function HomePage() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    api
      .get('/health')
      .then(() => setStatus('ok'))
      .catch(() => setStatus('down'));
  }, []);

  return (
    <section>
      <h1 className="text-2xl font-semibold">Storefront home</h1>
      <p className="mt-2 text-sm">
        API connection:{' '}
        <span className={status === 'ok' ? 'text-green-700' : status === 'down' ? 'text-red-700' : ''}>
          {status}
        </span>
      </p>
    </section>
  );
}