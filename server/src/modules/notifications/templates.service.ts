import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import type { MessageTemplate } from '../../models/Setting.js';
import { NOTIFICATION_TEMPLATES, type NotificationTemplate } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { getSettings } from '../settings/settings.service.js';
import { PLACEHOLDERS, TEMPLATE_INFO, renderTemplate, sampleValues, valuesForOrder } from './templates.js';
import type { PreviewTemplateInput, UpdateTemplateInput } from './templates.validation.js';

const FIELDS = ['emailSubject', 'emailBody', 'whatsappBody'] as const;

function describe(key: NotificationTemplate, template: MessageTemplate) {
  const info = TEMPLATE_INFO[key];
  return {
    key,
    ...info,
    emailSubject: template.emailSubject ?? null,
    emailBody: template.emailBody ?? null,
    whatsappBody: template.whatsappBody ?? null,
    // Ready = the business has written the words, so this message can be sent
    emailReady: info.email && Boolean(template.emailSubject && template.emailBody),
    whatsappReady: info.whatsapp && Boolean(template.whatsappBody),
  };
}

export async function listTemplates() {
  const settings = await getSettings();
  return {
    templates: NOTIFICATION_TEMPLATES.map((key) => describe(key, settings.templates[key] ?? {})),
    placeholders: Object.entries(PLACEHOLDERS).map(([name, meaning]) => ({ placeholder: `{{${name}}}`, meaning })),
  };
}

export async function updateTemplate(key: NotificationTemplate, input: UpdateTemplateInput, actor: ActorContext) {
  const info = TEMPLATE_INFO[key];
  if (!info.email && (input.emailSubject || input.emailBody)) {
    throw new AppError(`"${info.label}" is sent by WhatsApp only, so it has no email text`, 400);
  }

  const settings = await getSettings();
  const current = settings.templates[key] ?? {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  for (const field of FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    const next = value || undefined; // "" or null clears it
    if ((current[field] ?? undefined) !== next) {
      before[field] = current[field] ?? null;
      after[field] = next ?? null;
      settings.set(`templates.${key}.${field}`, next);
    }
  }

  if (Object.keys(after).length > 0) {
    await settings.save();
    await recordAudit({
      admin: actor.adminId,
      action: 'template.update',
      entityType: 'Setting',
      before: { template: key, ...before },
      after: { template: key, ...after },
      ip: actor.ip,
    });
  }

  return describe(key, settings.templates[key] ?? {});
}

// Shows exactly what the customer would receive
export async function previewTemplate(key: NotificationTemplate, input: PreviewTemplateInput) {
  const settings = await getSettings();
  const template = settings.templates[key] ?? {};

  let values = sampleValues(settings);
  if (input.order) {
    const filter = mongoose.isValidObjectId(input.order) ? { _id: input.order } : { orderNumber: input.order.toUpperCase() };
    const order = await Order.findOne(filter);
    if (!order) throw new AppError('Order not found', 404);
    values = valuesForOrder(order, settings);
  }

  return {
    key,
    usingSampleData: !input.order,
    emailSubject: template.emailSubject ? renderTemplate(template.emailSubject, values) : null,
    emailBody: template.emailBody ? renderTemplate(template.emailBody, values) : null,
    whatsappBody: template.whatsappBody ? renderTemplate(template.whatsappBody, values) : null,
  };
}