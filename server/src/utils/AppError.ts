export interface ErrorDetail {
  field: string;
  message: string;
}

export default class AppError extends Error {
  readonly statusCode: number;
  readonly details?: ErrorDetail[];
  readonly isOperational = true;

  constructor(message: string, statusCode = 400, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details) this.details = details;
  }
}