import type { Types } from 'mongoose';
import AuditLog from '../../models/AuditLog.js';

export interface AuditEntry {
  admin?: Types.ObjectId | string;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId | string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
}
 
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create(entry);
  } catch (error) {
    console.error('Failed to write audit log:', entry.action, error);
  } 
}

export interface ActorContext {
  adminId: string;
  ip?: string;
}