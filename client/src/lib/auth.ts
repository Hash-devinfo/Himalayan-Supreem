// Must match server/src/constants/auth.ts and server/src/modules/auth/auth.validation.ts
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;
export const RESET_LINK_MINUTES = 30;
export const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;