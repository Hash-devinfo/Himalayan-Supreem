import type { PaymentMethod, PaymentStatus } from '../../constants/enums.js';

// Every way of paying implements this (design 1.4). Checkout and order code only talk to this
// interface, so an approved online gateway can be added later without changing them.
// Card numbers and security codes are NEVER handled here: an online gateway takes payment on
// its own secure page (requirements 9).
export interface PaymentProvider {
  method: PaymentMethod;
  label: string; // shown at checkout
  description: string;
  isEnabled(): boolean; // only enabled methods are offered to customers
  initialStatus: PaymentStatus; // the order's payment status when it is placed
  collectedOnDelivery: boolean; // true = the courier collects the money (COD)
}