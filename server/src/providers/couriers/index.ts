import { COURIERS, type Courier } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import type { CourierProvider } from './courierProvider.js';
import { manualCourier } from './manual.js';

// TCS, PostEx and Leopards (requirements 5). Release 1.5: replace postex with the API provider here.
const PROVIDERS: Record<Courier, CourierProvider> = {
  tcs: manualCourier('tcs'),
  postex: manualCourier('postex'),
  leopards: manualCourier('leopards'),
};

export function courierProvider(code: Courier): CourierProvider {
  const provider = PROVIDERS[code];
  if (!provider) throw new AppError('Unknown courier', 400);
  return provider;
}

// For the admin's "choose courier" list
export function listCouriers() {
  return COURIERS.map((code) => ({ code, name: PROVIDERS[code].name, mode: PROVIDERS[code].mode }));
}