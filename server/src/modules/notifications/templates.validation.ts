import { z } from 'zod';
import { NOTIFICATION_TEMPLATES } from '../../constants/enums.js';
import { unknownPlaceholders } from './templates.js';

// Text with placeholders. "" or null clears it (that message is then not sent).
const templateText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} cannot be longer than ${max} characters`)
    .nullable()
    .optional()
    .superRefine((value, ctx) => {
      if (!value) return;
      const unknown = unknownPlaceholders(value);
      if (unknown.length > 0) {
        ctx.addIssue({ code: 'custom', message: `${label}: unknown placeholder ${unknown.map((n) => `{{${n}}}`).join(', ')}` });
      }
    });

export const templateKeySchema = z.enum(NOTIFICATION_TEMPLATES, `Template must be one of: ${NOTIFICATION_TEMPLATES.join(', ')}`);

export const updateTemplateSchema = z
  .strictObject({
    emailSubject: templateText('Email subject', 200),
    emailBody: templateText('Email text', 3000),
    whatsappBody: templateText('WhatsApp text', 1000),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one text to update' });

export const previewTemplateSchema = z
  .strictObject({
    // Preview with a real order's details; leave out for clearly fictional sample values
    order: z.string().trim().min(1).max(40).optional(),
  })
  .default({});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;