import { describe, expect, it } from 'vitest';
import { priceCart, type PricingLine, type PromotionRule } from '../src/modules/promotions/discount.engine.js';

// Fictional cart: almonds Rs 1000 x2 (dry fruits), oil Rs 1500 x1 (oils)
const almonds: PricingLine = { variantId: 'v-alm', productId: 'p-alm', categoryId: 'c-dry', unitPrice: 1000, qty: 2 };
const oil: PricingLine = { variantId: 'v-oil', productId: 'p-oil', categoryId: 'c-oil', unitPrice: 1500, qty: 1 };

const rule = (r: Partial<PromotionRule>): PromotionRule => ({ id: 'r', name: 'TEST', discountType: 'percent', value: 10, products: [], categories: [], ...r });

describe('Discount engine', () => {
  it('no promotions: nothing changes', () => {
    const cart = priceCart([almonds, oil], []);
    expect(cart).toMatchObject({ itemsTotal: 3500, discountTotal: 0, subtotal: 3500 });
  });

  it('a product promotion lowers only that product (percent of the line)', () => {
    const cart = priceCart([almonds, oil], [rule({ products: ['p-alm'], value: 10 })]);
    expect(cart.lines[0]).toMatchObject({ discount: 200, lineTotal: 1800 });
    expect(cart.lines[1]).toMatchObject({ discount: 0, lineTotal: 1500 });
    expect(cart.subtotal).toBe(3300);
  });

  it('a fixed automatic discount is rupees off each unit, never below zero', () => {
    const cart = priceCart([almonds], [rule({ discountType: 'fixed', value: 150, categories: ['c-dry'] })]);
    expect(cart.lines[0]!.discount).toBe(300);
    const huge = priceCart([almonds], [rule({ discountType: 'fixed', value: 5000 })]);
    expect(huge.lines[0]!.lineTotal).toBe(0);
  });

  it('when several automatic promotions apply, the customer gets the biggest (they do not add up)', () => {
    const cart = priceCart([almonds], [rule({ id: 'a', name: 'Small', value: 5 }), rule({ id: 'b', name: 'Big', categories: ['c-dry'], value: 15 })]);
    expect(cart.lines[0]).toMatchObject({ discount: 300, promotionName: 'Big' });
  });

  it('a percent code applies to items not already on sale', () => {
    const cart = priceCart([almonds, oil], [rule({ products: ['p-alm'], value: 10 })], rule({ id: 'code', name: 'CODE', value: 20 }));
    expect(cart.code).toMatchObject({ applied: true, discount: 300 }); // 20% of the oil only
    expect(cart.lines[0]!.promotionName).toBe('TEST');
    expect(cart.lines[1]).toMatchObject({ discount: 300, promotionName: 'CODE' });
    expect(cart.subtotal).toBe(3500 - 200 - 300);
  });

  it('a code on a cart where everything is on sale explains why it did not apply', () => {
    const cart = priceCart([almonds], [rule({ value: 10 })], rule({ id: 'code', value: 20 }));
    expect(cart.code).toMatchObject({ applied: false, message: expect.stringMatching(/already on sale/) });
    expect(cart.discountTotal).toBe(200);
  });

  it('minimum order is checked after automatic discounts', () => {
    const cart = priceCart([almonds], [], rule({ id: 'code', minOrderTotal: 2500 }));
    expect(cart.code).toMatchObject({ applied: false, message: expect.stringMatching(/Add Rs 500 more/) });
  });

  it('a fixed code is split over the lines and the parts add up exactly', () => {
    const third: PricingLine = { variantId: 'v3', productId: 'p3', categoryId: 'c-dry', unitPrice: 333, qty: 1 };
    const cart = priceCart([almonds, oil, third], [], rule({ id: 'code', discountType: 'fixed', value: 1000 }));
    const parts = cart.lines.map((l) => l.discount);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(1000);
    expect(parts.every(Number.isInteger)).toBe(true);
    expect(cart.subtotal).toBe(3833 - 1000);
  });

  it('a percent code respects its maximum discount; a fixed code never exceeds the items', () => {
    expect(priceCart([almonds, oil], [], rule({ id: 'c', value: 50, maxDiscount: 400 })).code?.discount).toBe(400);
    expect(priceCart([almonds], [], rule({ id: 'c', discountType: 'fixed', value: 9999 })).code?.discount).toBe(2000);
  });

  it('a code limited to a category ignores other items', () => {
    const cart = priceCart([almonds, oil], [], rule({ id: 'c', categories: ['c-oil'], value: 10 }));
    expect(cart.code?.discount).toBe(150);
    expect(cart.lines[0]!.discount).toBe(0);
    const none = priceCart([almonds], [], rule({ id: 'c', categories: ['c-oil'] }));
    expect(none.code?.message).toMatch(/does not apply to the items/);
  });
});