import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import env from '../../config/env.js';
import AppError from '../../utils/AppError.js';

// The photo storage provider (design 1.4). Product and settings code only call these functions,
// so another storage service could replace this file later.
//
// Photos are stored at most 2000 px on the longest side. The website gets smaller copies made
// by Cloudinary on the fly, in the best format for each browser (WebP/AVIF) and good quality.

export interface StoredImage {
  publicId: string;
  url: string; // large, for the product page (max 1200 px wide)
  thumbUrl: string; // small, for product cards and the cart (max 400 px wide)
  width: number;
  height: number;
  bytes: number;
  format: string;
}

let configured = false;

function setup(): void {
  if (!env.cloudinary) {
    throw new AppError('Photo uploads are not set up yet. Add the Cloudinary keys to the server .env file.', 503);
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }
}

export function isImageStorageConfigured(): boolean {
  return env.cloudinary !== null;
}

// A delivery link for a stored photo at a given width (never made bigger than the original)
export function imageUrl(publicId: string, width: number): string {
  setup();
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width, crop: 'limit' }, { fetch_format: 'auto', quality: 'auto' }],
  });
}

export async function uploadImage(file: Buffer, options: { folder: string; largeWidth?: number; thumbWidth?: number }): Promise<StoredImage> {
  setup();
  const folder = `${env.cloudinary!.folder}/${options.folder}`;

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'png', 'webp'],
        unique_filename: true,
        overwrite: false,
        // Stored at most 2000 px, so a huge phone photo does not use up the free storage
        transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
      },
      (error, uploaded) => (error || !uploaded ? reject(error ?? new Error('Upload failed')) : resolve(uploaded))
    );
    stream.end(file);
  }).catch((error: unknown) => {
    const message = (error as { message?: string }).message ?? 'unknown error';
    throw new AppError(`The photo could not be uploaded. Please try again. (${message.slice(0, 120)})`, 502);
  });

  return {
    publicId: result.public_id,
    url: imageUrl(result.public_id, options.largeWidth ?? 1200),
    thumbUrl: imageUrl(result.public_id, options.thumbWidth ?? 400),
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  };
}

// Deleting never stops the admin's action: a photo left behind in Cloudinary only uses some storage
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    setup();
    const result = (await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })) as { result?: string };
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    console.error(`Could not delete photo ${publicId} from Cloudinary:`, (error as Error).message);
    return false;
  }
}