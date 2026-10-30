import type { Types } from 'mongoose';
import AuditLog from '../../models/AuditLog.js';
import type { ClientSession } from 'mongoose';

export interface AuditEntry {
  admin?: Types.ObjectId | string;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId | string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
}
 
// Without a session: best effort (a failed log line never blocks the action, e.g. login).
// With a session: part of the transaction, so the change and its audit record save together or not at all.
export async function recordAudit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  if (session) {
    await AuditLog.create([entry], { session });
    return;
  }

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