import { api } from './client';
import type { Admin } from '../types/admin';

interface AdminResponse {
  success: true;
  admin: Admin;
}

interface MessageResponse {
  success: true;
  message: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AdminResponse>('/admin/auth/login', { email, password }),
  logout: () => api.post<MessageResponse>('/admin/auth/logout'),
  me: () => api.get<AdminResponse>('/admin/auth/me'),
  forgotPassword: (email: string) =>
    api.post<MessageResponse>('/admin/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string, confirmPassword: string) =>
    api.post<MessageResponse>('/admin/auth/reset-password', { token, password, confirmPassword }),
};