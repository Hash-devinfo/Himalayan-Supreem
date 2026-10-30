import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import AppError, { type ErrorDetail } from '../utils/AppError.js';
import env from '../config/env.js';

export interface ErrorResponse {
  success: false;
  message: string;
  details?: ErrorDetail[];
  stack?: string;
}

interface MongoDuplicateKeyError {
  code: 11000;
  keyValue?: Record<string, unknown>;
}

interface BodyParserError {
  type: 'entity.parse.failed' | 'entity.too.large';
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  const type = typeof err === 'object' && err !== null ? (err as { type?: unknown }).type : undefined;
  return type === 'entity.parse.failed' || type === 'entity.too.large';
}

export default function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Something went wrong. Please try again.';
  let details: ErrorDetail[] | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    message = `A record with this ${field} already exists`;
  } else if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      statusCode = 400;
      message = 'Request body is not valid JSON';
    } else {
      statusCode = 413;
      message = 'Request body is too large';
    }
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  const body: ErrorResponse = { success: false, message };
  if (details) body.details = details;
  if (!env.isProduction && statusCode >= 500 && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}