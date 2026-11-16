import { createContext } from 'react';
import type { Admin } from '../../../types/admin';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

export interface AdminAuthValue {
  admin: Admin | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AdminAuthContext = createContext<AdminAuthValue | null>(null);