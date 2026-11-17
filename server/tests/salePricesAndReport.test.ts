import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { getCart } from '../src/modules/cart/cart.service.js';
import { cancelOrder } from '../src/modules/orders/order.service.js';
import { getPublicProductBySlug, listPublicProducts } from '../src/modules/products/product.public.service.js';
import { listProductsPublicQuerySchema } from '../src/modules/products/product.validation.js';
import { applyPromoCode } from '../src/modules/promotions/cartPromo.service.js';
import { changePromotionStatus, createPromotion } from '../src/modules/promotions/promotion.service.js';
import { createPromotionSchema } from '../src/modules/promotions/promotion.validation.js';
import { promotionsReport } from '../src/modules/reports/promotionReport.service.js';
import { promotionsCsv } from '../src/modules/reports/reportCsv.js';
import { actor, addToCart, checkout, createStore, createVariant, logCallConfirmAndDeliver, pktDay, receive } from './helpers/fixtures.js';

const promo = (input: unknown) => createPromotion(createPromotionSchema.parse(input), actor);
const list = () => listPublicProducts(listProductsPublicQuerySchema.parse({}));

async function store() {
  const { product, category, cityId } = await createStore({ deliveryCharge: 250 });
  const small = await createVariant(product._id, { label: '250 g', price: 1000 });
  const large = await createVariant(product._id, { label: '1 kg', price: 3500 });
  await receive(small, 'S1', 20, 200);
  await receive(large, 'L1', 20, 200);
  return { product, category, cityId, small, large };
}

describe('Sale prices on product pages and lists', () => {
  it('no sale running: no sale price is shown', async () => {
    const { product } = await store();
    const page = await getPublicProductBySlug(product.slug);
    expect(page.sale).toBeUndefined();
    expect(page.variants.every((v) => v.salePrice === undefined)).toBe(true);
  });

  it('a category sale shows on every size, with its name and last day, and matches the cart', async () => {
    const { product, category, small } = await store();
    await promo({ name: 'TEST Winter sale', type: 'seasonal', categories: [category.id], discountType: 'percent', value: 10, endsOn: pktDay(5) });

    const page = await getPublicProductBySlug(product.slug);
    expect(page.sale).toEqual({ promotionName: 'TEST Winter sale', endsOn: pktDay(5) });
    expect(page.variants.map((v) => [v.price, v.salePrice])).toEqual([[1000, 900], [3500, 3150]]);

    const cart = await getCart(await addToCart([{ variant: small, qty: 1 }]));
    expect(cart.subtotal).toBe(page.variants[0]!.salePrice);
  });

  it('product cards show the lowest and highest sale price', async () => {
    const { product } = await store();
    await promo({ name: 'TEST Rs 100 off', type: 'product', products: [product.id], discountType: 'fixed', value: 100 });

    const card = (await list()).items[0]!;
    expect(card).toMatchObject({ minPrice: 1000, maxPrice: 3500 });
    expect(card.sale).toMatchObject({ promotionName: 'TEST Rs 100 off', minSalePrice: 900, maxSalePrice: 3400 });
  });

  it('when two sales apply, the page shows the bigger one (same rule as the cart)', async () => {
    const { product, category } = await store();
    await promo({ name: 'TEST small', type: 'category', categories: [category.id], discountType: 'percent', value: 5 });
    await promo({ name: 'TEST big', type: 'product', products: [product.id], discountType: 'percent', value: 20 });

    const page = await getPublicProductBySlug(product.slug);
    expect(page.sale?.promotionName).toBe('TEST big');
    expect(page.variants[0]!.salePrice).toBe(800);
  });

  it('codes never change shown prices; a paused sale disappears', async () => {
    const { product } = await store();
    await promo({ name: 'TEST code', type: 'code', code: 'SECRET', discountType: 'percent', value: 50 });
    const sale = await promo({ name: 'TEST sale', type: 'product', products: [product.id], discountType: 'percent', value: 10 });
    expect((await getPublicProductBySlug(product.slug)).variants[0]!.salePrice).toBe(900);

    await changePromotionStatus(sale.id, 'pause', actor);
    expect((await getPublicProductBySlug(product.slug)).variants[0]!.salePrice).toBeUndefined();
    expect((await list()).items[0]!.sale).toBeUndefined();
  });

  it('HTTP: the public product page includes sale prices', async () => {
    const { product } = await store();
    await promo({ name: 'TEST sale', type: 'product', products: [product.id], discountType: 'percent', value: 10 });
    const res = await request(app).get(`/api/products/${product.slug}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('"salePrice":900');
  });
});

describe('Promotions report', () => {
  it('counts orders, discount given and sales per promotion, by what became of the orders', async () => {
    const { product, cityId, small, large } = await store();
    await promo({ name: 'TEST Almond sale', type: 'product', products: [product.id], discountType: 'percent', value: 10 });

    // Delivered: 2 small (Rs 200 off) + 1 large (Rs 350 off) in one order
    const delivered = await checkout(await addToCart([{ variant: small, qty: 2 }, { variant: large, qty: 1 }]), cityId);
    await logCallConfirmAndDeliver(delivered.orderNumber);
    // Cancelled: 1 small
    const cancelled = await checkout(await addToCart([{ variant: small, qty: 1 }]), cityId);
    await cancelOrder(cancelled.orderNumber, { reason: 'TEST' }, actor);
    // Still open: 1 small
    await checkout(await addToCart([{ variant: small, qty: 1 }]), cityId);

    const report = await promotionsReport({ format: 'json' });
    expect(report.promotions).toHaveLength(1);
    expect(report.promotions[0]).toMatchObject({
      name: 'TEST Almond sale',
      type: 'product',
      orders: 3,
      delivered: 1,
      cancelled: 1,
      open: 1,
      unitsDelivered: 3,
      discountGiven: 550,
      salesAfterDiscount: 2000 - 200 + 3500 - 350,
    });
    expect(report.summary).toMatchObject({ promotionsUsed: 1, deliveredOrdersWithPromotion: 1, shareOfDeliveredOrders: 100 });
  });

  it('codes are listed with their code; CSV export works', async () => {
    const { cityId, small } = await store();
    await promo({ name: 'TEST Eid code', type: 'code', code: 'EIDREPORT', discountType: 'fixed', value: 150 });
    const session = await addToCart([{ variant: small, qty: 1 }]);
    await applyPromoCode(session, 'EIDREPORT');
    const placed = await checkout(session, cityId);
    await logCallConfirmAndDeliver(placed.orderNumber);

    const report = await promotionsReport({ format: 'json' });
    expect(report.promotions[0]).toMatchObject({ code: 'EIDREPORT', discountGiven: 150, salesAfterDiscount: 850 });

    const { filename, csv } = promotionsCsv(report);
    expect(filename).toMatch(/^promotions-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain('EIDREPORT');
  });

  it('the report route needs a login', async () => {
    expect((await request(app).get('/api/admin/reports/promotions')).status).toBe(401);
  });
});