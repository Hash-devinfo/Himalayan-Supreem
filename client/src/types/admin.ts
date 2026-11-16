export interface Admin {
  _id: string;
  name: string;
  email: string;
  role: 'owner';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}