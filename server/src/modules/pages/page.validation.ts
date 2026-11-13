import { z } from 'zod';
import { PAGE_SLUGS } from '../../constants/enums.js';

export const pageSlugSchema = z.enum(PAGE_SLUGS, `Page must be one of: ${PAGE_SLUGS.join(', ')}`);

export const updatePageSchema = z
  .strictObject({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120).optional(),
    content: z
      .string()
      .trim()
      .min(20, 'Write the page content (at least 20 characters)')
      .max(50_000, 'Content cannot be longer than 50,000 characters')
      // Stored and shown as text, never as HTML, so a pasted <script> can never run on the site
      .refine((text) => !/<\s*\/?\s*[a-z][^>]*>/i.test(text), 'Use plain text (headings with #, lists with -), not HTML tags')
      .optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, { message: 'Provide a title or content to update' });

export type UpdatePageInput = z.infer<typeof updatePageSchema>;