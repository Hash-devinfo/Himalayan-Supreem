import { Schema, model, type MongooseQueryMiddleware, type Types } from 'mongoose';

export interface IAuditLog {
  admin?: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'Admin' },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: Schema.Types.ObjectId },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ admin: 1, createdAt: -1 });

// Append-only: audit records can be added, never changed or removed.
const blockedOperations: MongooseQueryMiddleware[] = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

auditLogSchema.pre(blockedOperations, function () {
  throw new Error('Audit log records cannot be changed or deleted');
});

auditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Audit log records cannot be changed');
  }
});

const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;