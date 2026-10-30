import type { NextFunction, Request, Response } from 'express';
import type { z, ZodType } from 'zod';
import AppError from '../utils/AppError.js';

export function parseOrThrow<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.map(String).join('.') || 'body',
      message: issue.message,
    }));
    throw new AppError('Please check your details', 400, details);
  }

  return result.data;
}

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = parseOrThrow(schema, req.body);
    next();
  };
}