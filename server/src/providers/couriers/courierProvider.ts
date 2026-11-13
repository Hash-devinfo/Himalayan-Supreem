import type { Courier } from '../../constants/enums.js';

// Every courier implements this (design 1.4). Release 1: all couriers are "manual" (the admin
// books the parcel at the courier and types the tracking number). Release 1.5 adds a PostEx
// provider that books the parcel itself, without changing the order code that calls this.
export interface CourierProvider {
  code: Courier;
  name: string;
  mode: 'manual' | 'api';
  // Called when an order is dispatched; returns the tracking number to save on the order
  registerShipment(input: { orderNumber: string; trackingNumber?: string }): Promise<{ trackingNumber: string }>;
  // A public tracking page for customers, or null if none is set up (never guessed)
  trackingUrl(trackingNumber: string): string | null;
}