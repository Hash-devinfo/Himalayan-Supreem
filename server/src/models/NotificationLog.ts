import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATES,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationTemplate,
} from '../constants/enums.js';

// Every message to a customer: what, to whom, and what happened (design 3.8)
export interface INotificationLog {
  order: Types.ObjectId;
  channel: NotificationChannel;
  template: NotificationTemplate;
  recipient: string; // email address or +923XXXXXXXXX
  subject?: string;
  body: string; // the text as sent (or prepared)
  status: NotificationStatus;
  attempts: number;
  lastError?: string; // never contains passwords or other secrets
  sentAt?: Date;
  createdBy?: Types.ObjectId; // admin; empty for automatic emails
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationLogDocument = HydratedDocument<INotificationLog>;

const notificationLogSchema = new Schema<INotificationLog>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    template: { type: String, enum: NOTIFICATION_TEMPLATES, required: true },
    recipient: { type: String, required: true },
    subject: { type: String, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: NOTIFICATION_STATUSES, required: true, default: 'queued' },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, maxlength: 500 },
    sentAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

notificationLogSchema.index({ order: 1, createdAt: -1 });
// For the "failed emails" list on the dashboard
notificationLogSchema.index({ status: 1, channel: 1, createdAt: -1 });

const NotificationLog = model<INotificationLog>('NotificationLog', notificationLogSchema);

export default NotificationLog;