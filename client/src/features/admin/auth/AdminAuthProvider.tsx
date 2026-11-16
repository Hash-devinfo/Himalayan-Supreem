import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../../../api/auth';
import type { Admin } from '../../../types/admin';
import { AdminAuthContext, type AuthStatus } from './AuthContext';

export default function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // On first load, ask the server whether the admin_token cookie is still valid
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setAdmin(res.admin);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setAdmin(null);
        setStatus('guest');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setAdmin(res.admin);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAdmin(null);
      setStatus('guest');
    }
  }, []);

  const value = useMemo(() => ({ admin, status, login, logout }), [admin, status, login, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}