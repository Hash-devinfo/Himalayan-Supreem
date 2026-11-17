// Admin password reset by email (requirements 4.5)
export const RESET_LINK_MINUTES = 30; // how long a reset link works
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt only uses the first 72 bytes