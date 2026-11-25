import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import AppError from '../utils/AppError.js';

// Receives ONE photo in the form field "image" (multipart/form-data), kept in memory only.
// The file type is checked again from the file's own bytes in media/imageFile.ts.
export function imageUpload(maxMegabytes: number) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMegabytes * 1024 * 1024, files: 1, fields: 5 },
  }).single('image');

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (error: unknown) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') return next(new AppError(`The photo is too big. The largest allowed is ${maxMegabytes} MB.`, 413));
        if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError('Send one photo, in the form field named "image"', 400));
        }
        return next(new AppError('The upload could not be read. Please try again.', 400));
      }
      next(error);
    });
  };
}