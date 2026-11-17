import type { Types } from 'mongoose';
import { addDays, formatPktDate } from '../../utils/dates.js';
import { liveAutomaticPromotions } from './cartPricing.js';
import { automaticDiscount, inScope, type PromotionRule } from './discount.engine.js';
import { toRule } from './promotion.service.js';

// Sale prices for product pages and product lists (Phase 17C).
// Shown per unit. The cart works out the exact discount for the quantity chosen, and the cart
// total is what the customer pays (a percent sale on several units can differ by a rupee from
// "unit sale price x quantity" because of rounding).

export interface SaleRule extends PromotionRule {
  endsOn: string | null; // last day of the sale, Pakistan time
}

export interface PublicSale {
  promotionName: string;
  endsOn: string | null;
}

export async function liveSaleRules(): Promise<SaleRule[]> {
  const promos = await liveAutomaticPromotions();
  return promos.map((p) => ({ ...toRule(p), endsOn: p.endsAt ? formatPktDate(addDays(p.endsAt, -1)) : null }));
}

// The best automatic sale for one unit of a size (the same "biggest wins" rule as the cart)
export function bestSale(
  rules: SaleRule[],
  productId: Types.ObjectId | string,
  categoryId: Types.ObjectId | string | undefined,
  price: number
): { salePrice: number; sale: PublicSale } | undefined {
  const line = { variantId: '', productId: String(productId), categoryId: categoryId ? String(categoryId) : '', unitPrice: price, qty: 1 };
  let best: { rule: SaleRule; amount: number } | undefined;
  for (const rule of rules) {
    if (!inScope(rule, line)) continue;
    const amount = Math.min(automaticDiscount(rule, line), price);
    if (amount > 0 && (!best || amount > best.amount)) best = { rule, amount };
  }
  if (!best) return undefined;
  return { salePrice: price - best.amount, sale: { promotionName: best.rule.name, endsOn: best.rule.endsOn } };
}