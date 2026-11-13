import type { Courier } from './enums.js';

// Courier names shown to customers and in reports (one place for the whole app)
export const COURIER_NAMES: Record<Courier, string> = { tcs: 'TCS', postex: 'PostEx', leopards: 'Leopards' };