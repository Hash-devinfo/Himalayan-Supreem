import { Schema, model, type HydratedDocument } from 'mongoose';
import { ADMIN_ROLES, type AdminRole } from '../constants/enums.js';

export interface IAdmin {
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: Date;
  failedLoginCount: number;
  lockUntil?: Date;
  passwordChangedAt?: Date;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminDocument = HydratedDocument<IAdmin>;

const adminSchema = new Schema<IAdmin>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot be longer than 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      default: 'owner',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: Date,
    failedLoginCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockUntil: Date,
    passwordChangedAt: Date,
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const safe: Record<string, unknown> = { ...ret };
        delete safe.passwordHash;
        delete safe.resetTokenHash;
        delete safe.resetTokenExpires;
        delete safe.__v;
        return safe;
      },
    },
  }
);

const Admin = model<IAdmin>('Admin', adminSchema);

export default Admin;