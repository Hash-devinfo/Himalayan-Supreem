import type { PaymentMethod } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { codProvider } from './cod.js';
import type { PaymentProvider } from './paymentProvider.js';

// All payment methods the store knows. Release 3: add the approved gateway here.
const PROVIDERS: Record<PaymentMethod, PaymentProvider> = {
  cod: codProvider,
};

// For the checkout page: only the methods that are switched on (requirements 3.2)
export function availablePaymentMethods() {
  return Object.values(PROVIDERS)
    .filter((p) => p.isEnabled())
    .map((p) => ({ method: p.method, label: p.label, description: p.description }));
}

// The payment part of a new order. Refuses a method that is not enabled.
export function startPayment(method: PaymentMethod) {
  const provider = PROVIDERS[method];
  if (!provider || !provider.isEnabled()) throw new AppError('This payment method is not available. Please choose another.', 400);
  return { method: provider.method, status: provider.initialStatus };
}