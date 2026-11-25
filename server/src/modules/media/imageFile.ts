import AppError from '../../utils/AppError.js';

// Checks the file is really a JPEG, PNG or WebP photo by reading its first bytes,
// not by trusting the file name or the type the browser says it is.
// SVG and GIF are refused (SVG files can contain scripts).
export type ImageKind = 'jpeg' | 'png' | 'webp';

export function detectImageKind(bytes: Buffer): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export function assertPhoto(file: Express.Multer.File | undefined): Buffer {
  if (!file) throw new AppError('Choose a photo to upload (form field "image")', 400);
  if (!detectImageKind(file.buffer)) throw new AppError('Please upload a JPG, PNG or WebP photo', 400);
  return file.buffer;
}