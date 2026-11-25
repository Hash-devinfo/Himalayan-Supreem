import { COURIER_NAMES } from '../../../constants/couriers.js';
import AppError from '../../../utils/AppError.js';
import type { CourierProvider } from '../courierProvider.js';

// PostEx (Phase 20B). The parcel is booked first ("Book with PostEx" while the order is in
// Packing); shipping then uses the booked tracking number. If PostEx is down, the admin can
// still book in the PostEx portal and type the tracking number by hand.
export function postexCourier(): CourierProvider {
  return {
    code: 'postex',
    name: COURIER_NAMES.postex,
    mode: 'api',
    async registerShipment({ trackingNumber, booking }) {
      if (booking?.status === 'booked' && booking.trackingNumber) {
        if (trackingNumber && trackingNumber !== booking.trackingNumber) {
          throw new AppError(`This order is booked with PostEx as ${booking.trackingNumber}. Leave the tracking number empty, or cancel the booking first.`, 409);
        }
        return { trackingNumber: booking.trackingNumber };
      }
      if (booking?.status === 'booking' || booking?.status === 'unknown') {
        // We don't know yet whether PostEx created a parcel: typing another number could mean two parcels
        throw new AppError('The PostEx booking for this order is not finished. Press "Book with PostEx" again to check it first.', 409);
      }
      if (!trackingNumber) {
        throw new AppError('Book the parcel with PostEx first, or type the tracking number if you booked it in the PostEx portal', 400);
      }
      return { trackingNumber };
    },
    // No tracking link until the business confirms PostEx's official tracking page
    trackingUrl: () => null,
  };
}