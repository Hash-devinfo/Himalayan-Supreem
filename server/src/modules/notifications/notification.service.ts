import mongoose, { type Types } from 'mongoose';
import NotificationLog from '../../models/NotificationLog.js';
import Order from '../../models/Order.js';
import type { NotificationChannel, NotificationStatus, NotificationTemplate } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { describeEmailError, sendEmail } from '../../providers/notifications/email.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { getSettings } from '../settings/settings.service.js';
import { TEMPLATE_INFO, renderTemplate, valuesForOrder } from './templates.js';

// ── Sending one email (and logging it) ────────────────

async function deliverLoggedEmail(logId: Types.ObjectId): Promise<void> {
  const log = await NotificationLog.findById(logId);
  if (!log || log.channel !== 'email') return;

  log.attempts += 1;
  try {
    await sendEmail({ to: log.recipient, subject: log.subject ?? '', text: log.body });
    log.status = 'sent';
    log.sentAt = new Date();
    log.lastError = undefined;
  } catch (error) {
    log.status = 'failed';
    log.lastError = describeEmailError(error);
  }
  await log.save();
}

// The order's automatic email for this step (design 3.8), if the customer gave an email
// and the business has written this template. Returns the log entry, or null if nothing to send.
export async function sendOrderEmail(orderId: Types.ObjectId | string, template: NotificationTemplate) {
  if (!TEMPLATE_INFO[template].email) return null;

  const [order, settings] = await Promise.all([Order.findById(orderId), getSettings()]);
  if (!order?.customerSnapshot.email) return null; // email is optional at checkout

  const words = settings.templates[template];
  if (!words?.emailSubject || !words.emailBody) return null; // not written yet: not sent

  const values = valuesForOrder(order, settings);
  const log = await NotificationLog.create({
    order: order._id,
    channel: 'email',
    template,
    recipient: order.customerSnapshot.email,
    subject: renderTemplate(words.emailSubject, values),
    body: renderTemplate(words.emailBody, values),
    status: 'queued',
  });

  await deliverLoggedEmail(log._id);
  return NotificationLog.findById(log._id);
}

// Called AFTER an order change has been saved. It never waits and never throws, so a slow or
// broken email server can never slow down, fail or undo the order itself.
export function notifyOrder(orderId: Types.ObjectId | string, template: NotificationTemplate): void {
  sendOrderEmail(orderId, template).catch((error: unknown) => {
    console.error(`Notification "${template}" for order ${String(orderId)} could not be prepared:`, error);
  });
}

// ── For the admin ─────────────────────────────────────

export interface ListNotificationsQuery {
  order?: string;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  page: number;
  limit: number;
}

export async function listNotifications(query: ListNotificationsQuery) {
  const filter: Record<string, unknown> = {};
  if (query.order) {
    const order = await Order.findOne(
      mongoose.isValidObjectId(query.order) ? { _id: query.order } : { orderNumber: query.order.toUpperCase() }
    ).select('_id');
    if (!order) throw new AppError('Order not found', 404);
    filter.order = order._id;
  }
  if (query.status) filter.status = query.status;
  if (query.channel) filter.channel = query.channel;

  const [items, total] = await Promise.all([
    NotificationLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate<{ order: { orderNumber: string } }>('order', 'orderNumber')
      .lean(),
    NotificationLog.countDocuments(filter),
  ]);

  return {
    notifications: items.map((n) => ({
      id: String(n._id),
      orderNumber: n.order?.orderNumber ?? null,
      channel: n.channel,
      template: n.template,
      label: TEMPLATE_INFO[n.template].label,
      recipient: n.recipient,
      subject: n.subject ?? null,
      status: n.status,
      attempts: n.attempts,
      lastError: n.lastError ?? null,
      sentAt: n.sentAt ?? null,
      createdAt: n.createdAt,
    })),
    total,
    page: query.page,
    pages: Math.ceil(total / query.limit),
  };
}

// The "Retry" button for a failed email: sends the SAME message again
export async function retryNotification(id: string, actor: ActorContext) {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Notification not found', 404);
  const log = await NotificationLog.findById(id);
  if (!log) throw new AppError('Notification not found', 404);
  if (log.channel !== 'email') throw new AppError('Only emails can be retried. WhatsApp messages are sent from your phone.', 400);
  if (log.status !== 'failed') throw new AppError(`This email is "${log.status}", not failed`, 409);

  // Claim it first, so two clicks on Retry cannot send it twice
  const claimed = await NotificationLog.updateOne({ _id: log._id, status: 'failed' }, { $set: { status: 'queued' } });
  if (claimed.modifiedCount !== 1) throw new AppError('This email is already being retried', 409);

  await deliverLoggedEmail(log._id);
  const updated = await NotificationLog.findById(log._id);

  await recordAudit({
    admin: actor.adminId,
    action: 'notification.retry',
    entityType: 'NotificationLog',
    entityId: log.id,
    after: { status: updated?.status, attempts: updated?.attempts },
    ip: actor.ip,
  });

  return updated;
}