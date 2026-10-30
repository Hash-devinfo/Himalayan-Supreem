import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

function createLimiter(
  windowMinutes: number,
  limit: number,
  message: string,
  skipSuccessfulRequests = false
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message },
  });
}

// All API routes: normal browsing never gets near this
export const apiLimiter = createLimiter(
  15,
  300,
  'Too many requests. Please slow down and try again shortly.'
);

// Admin login: 5 failed attempts per 15 minutes
export const loginLimiter = createLimiter(
  15,
  5,
  'Too many login attempts. Please try again in 15 minutes.',
  true
);

// Order status lookup: stops guessing order numbers
export const orderLookupLimiter = createLimiter(
  15,
  10,
  'Too many lookup attempts. Please try again in 15 minutes.'
);

// Checkout: stops fake orders that would lock up stock
export const checkoutLimiter = createLimiter(
  60,
  10,
  'Too many orders from this connection. Please contact support if you need help.'
);