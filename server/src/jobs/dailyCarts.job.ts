import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import { ABANDONED_AFTER_HOURS } from '../constants/cart.js';

// Marks carts that have items but no activity for ABANDONED_AFTER_HOURS as "abandoned",
// for the analytics report (design 1.5). Nobody is contacted. A returning customer's cart reopens.
export async function markAbandonedCarts(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000);
  const filter: Record<string, unknown> = {
    status: 'active',
    lastActivityAt: mongoose.trusted({ $lt: before }),
    'items.0': mongoose.trusted({ $exists: true }), // has at least one item
  };
  // timestamps: false, so "updatedAt" does not pretend the customer did something
  const result = await Cart.updateMany(filter, { $set: { status: 'abandoned' } }, { timestamps: false });
  return result.modifiedCount;
}