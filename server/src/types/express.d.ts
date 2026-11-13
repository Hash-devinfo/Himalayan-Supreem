import type { AdminDocument } from '../models/Admin.js';

declare global {
  namespace Express {
    interface Request {
      admin?: AdminDocument;
       visitorId?: string;
    }
  }
}

export {};