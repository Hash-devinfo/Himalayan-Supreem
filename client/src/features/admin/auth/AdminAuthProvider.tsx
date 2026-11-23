import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../../api/auth';
import { ApiError } from '../../../api/client';
import type { Admin } from '../../../types/admin';
import { AdminAuthContext, type AuthStatus } from './AuthContext';

export default function AdminAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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

  // If any admin data request answers "not logged in" (session expired, or password changed elsewhere),
  // show the login screen. RequireAdmin remembers the page, so login brings the admin back to it.
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      const { error } = event.action;
      if (error instanceof ApiError && error.status === 401) {
        setAdmin(null);
        setStatus('guest');
      }
    });
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setAdmin(res.admin);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear(); // no admin data left in memory after logging out
      setAdmin(null);
      setStatus('guest');
    }
  }, [queryClient]);

  const value = useMemo(() => ({ admin, status, login, logout }), [admin, status, login, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}