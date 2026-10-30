import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import AppError from '../utils/AppError.js';

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || 'body',
        message: issue.message,
      }));
      throw new AppError('Please check your details', 400, details);
    }

    req.body = result.data;
    next();
  };
}