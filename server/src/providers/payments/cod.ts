import type { PaymentProvider } from './paymentProvider.js';

// Cash on delivery: the launch payment method. The courier collects the order total at the door;
// the admin records it when the order is delivered, and the courier later pays it to the store.
export const codProvider: PaymentProvider = {
  method: 'cod',
  label: 'Cash on delivery',
  description: 'Pay the courier in cash when your order arrives.',
  isEnabled: () => true,
  initialStatus: 'pending',
  collectedOnDelivery: true,
};