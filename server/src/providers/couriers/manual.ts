import type { Courier } from '../../constants/enums.js';
import { COURIER_NAMES } from '../../constants/couriers.js';
import AppError from '../../utils/AppError.js';
import type { CourierProvider } from './courierProvider.js';

// Manual courier: the admin books the parcel with the courier and enters the tracking number
// from the receipt (requirements 5: manual tracking entry is required for the first version).
export function manualCourier(code: Courier): CourierProvider {
  return {
    code,
    name: COURIER_NAMES[code],
    mode: 'manual',
    async registerShipment({ trackingNumber }) {
      if (!trackingNumber) throw new AppError(`Enter the ${COURIER_NAMES[code]} tracking number from the courier receipt`, 400);
      return { trackingNumber };
    },
    // No tracking link until the business confirms each courier's official tracking page
    trackingUrl: () => null,
  };
}