import { api } from './client';
import type { Admin } from '../types/admin';

interface AdminResponse {
  success: true;
  admin: Admin;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AdminResponse>('/admin/auth/login', { email, password }),
  logout: () => api.post<{ success: true; message: string }>('/admin/auth/logout'),
  me: () => api.get<AdminResponse>('/admin/auth/me'),
};