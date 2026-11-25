import { z } from 'zod';

// Alt text: a short description for people who cannot see the photo, and for search engines
export const altText = z
  .string('Describe the photo in a few words (alt text)')
  .trim()
  .min(3, 'Describe the photo in a few words (alt text)')
  .max(150, 'Alt text can be at most 150 characters');

// Sent with the photo, as a normal form field next to "image"
export const uploadImageFieldsSchema = z.strictObject({ alt: altText });

const publicId = z.string('Choose a photo').trim().min(1, 'Choose a photo').max(300);

export const updateImageSchema = z.strictObject({ publicId, alt: altText });
export const removeImageSchema = z.strictObject({ publicId });
export const reorderImagesSchema = z.strictObject({
  publicIds: z.array(publicId, 'Send the photos in their new order').min(1).max(20),
});

export type UpdateImageInput = z.infer<typeof updateImageSchema>;
export type RemoveImageInput = z.infer<typeof removeImageSchema>;
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;