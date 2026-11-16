import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import Promotion from '../src/models/Promotion.js';
import PromotionRedemption from '../src/models/PromotionRedemption.js';
import Setting from '../src/models/Setting.js';
import { getCart } from '../src/modules/cart/cart.service.js';
import { cancelOrder } from '../src/modules/orders/order.service.js';
import { applyPromoCode, removePromoCode } from '../src/modules/promotions/cartPromo.service.js';
import { changePromotionStatus, createPromotion } from '../src/modules/promotions/promotion.service.js';
import { createPromotionSchema } from '../src/modules/promotions/promotion.validation.js';
import { createRefund } from '../src/modules/refunds/refund.service.js';
import { actor, addToCart, checkout, createStore, createVariant, findOrder, logCallConfirmAndDeliver, nextPhone, receive } from './helpers/fixtures.js';

const promo = (input: unknown) => createPromotion(createPromotionSchema.parse(input), actor);

// A store with almonds Rs 1000 (dry fruits) and oil Rs 1500 (another category), 20 of each
async function store() {
  const { product, category, cityId } = await createStore({ deliveryCharge: 250 });
  const almonds = await createVariant(product._id, { price: 1000 });
  await receive(almonds, 'A1', 20, 200);
  return { product, category, cityId, almonds };
}

describe('Automatic promotions at checkout', () => {
  it('a product sale lowers the item in the cart and the order records it per item', async () => {
    const { product, cityId, almonds } = await store();
    await promo({ name: 'TEST Almond sale', type: 'product', products: [product.id], discountType: 'percent', value: 10 });

    const session = await addToCart([{ variant: almonds, qty: 2 }]);
    const cart = await getCart(session);
    expect(cart).toMatchObject({ itemsTotal: 2000, discountTotal: 200, subtotal: 1800 });
    expect(cart.items[0]).toMatchObject({ discount: 200, lineTotal: 1800, promotionName: 'TEST Almond sale' });

    const placed = await checkout(session, cityId);
    expect(placed.pricing).toMatchObject({ subtotal: 1800, deliveryCharge: 250, total: 2050 });
    const saved = await findOrder(placed.orderNumber);
    expect(saved.items[0]).toMatchObject({ unitPrice: 1000, discount: 200, lineTotal: 1800, promotionName: 'TEST Almond sale' });
  });

  it('free delivery is decided on the total after discounts', async () => {
    const { product, cityId, almonds } = await store();
    await Setting.updateOne({}, { $set: { freeDeliveryThreshold: 2000 } });
    await promo({ name: 'TEST sale', type: 'product', products: [product.id], discountType: 'percent', value: 10 });

    const placed = await checkout(await addToCart([{ variant: almonds, qty: 2 }]), cityId); // 2000 -> 1800
    expect(placed.pricing.deliveryCharge).toBe(250);
  });
});

describe('Discount codes at checkout', () => {
  it('a wrong or ended code is refused', async () => {
    const { almonds } = await store();
    const session = await addToCart([{ variant: almonds, qty: 1 }]);
    await expect(applyPromoCode(session, 'NOPE')).rejects.toThrow('This code is not valid or has expired');

    const ended = await promo({ name: 'TEST', type: 'code', code: 'OLDONE', discountType: 'fixed', value: 100 });
    await changePromotionStatus(ended.id, 'end', actor);
    await expect(applyPromoCode(session, 'OLDONE')).rejects.toThrow('This code is not valid or has expired');
  });

  it('a code gives its discount, and the order records the code and one use', async () => {
    const { cityId, almonds } = await store();
    await promo({ name: 'TEST Eid', type: 'code', code: 'EIDTEST', discountType: 'fixed', value: 300 });
    const session = await addToCart([{ variant: almonds, qty: 2 }]);

    const { view } = await applyPromoCode(session, 'eidtest');
    expect(view.promoCode).toMatchObject({ code: 'EIDTEST', applied: true, discount: 300 });
    expect(view.subtotal).toBe(1700);

    const placed = await checkout(session, cityId);
    expect(placed.promotion).toEqual({ code: 'EIDTEST', name: 'TEST Eid', discount: 300 });
    expect(placed.pricing.total).toBe(1700 + 250);
    expect((await Promotion.findOne({ code: 'EIDTEST' }))!.usageCount).toBe(1);
    expect(await PromotionRedemption.countDocuments({ status: 'used', amount: 300 })).toBe(1);
  });

  it('a code below its minimum order stays in the cart with a message and gives no discount yet', async () => {
    const { almonds } = await store();
    await promo({ name: 'TEST', type: 'code', code: 'BIGBUY', discountType: 'percent', value: 10, minOrderTotal: 3000 });
    const session = await addToCart([{ variant: almonds, qty: 2 }]);

    const { view } = await applyPromoCode(session, 'BIGBUY');
    expect(view.promoCode).toMatchObject({ applied: false, message: expect.stringMatching(/Add Rs 1000 more/) });
    expect(view.discountTotal).toBe(0);
  });

  it('one use per customer: the same phone cannot use it twice', async () => {
    const { cityId, almonds } = await store();
    await promo({ name: 'TEST', type: 'code', code: 'ONCE', discountType: 'fixed', value: 100, perCustomerLimit: 1 });
    const phone = nextPhone();

    const first = await addToCart([{ variant: almonds, qty: 1 }]);
    await applyPromoCode(first, 'ONCE');
    await checkout(first, cityId, phone);

    const second = await addToCart([{ variant: almonds, qty: 1 }]);
    await applyPromoCode(second, 'ONCE');
    await expect(checkout(second, cityId, phone)).rejects.toThrow(/already used the code ONCE/);

    // Nothing from the refused order was saved; removing the code lets them order
    await removePromoCode(second);
    await expect(checkout(second, cityId, phone)).resolves.toMatchObject({ promotion: null });
  });

  it('a used-up code is removed from other carts, and the customer is asked to review', async () => {
    const { cityId, almonds } = await store();
    await promo({ name: 'TEST', type: 'code', code: 'LASTONE', discountType: 'fixed', value: 100, usageLimit: 1 });
    const a = await addToCart([{ variant: almonds, qty: 1 }]);
    const b = await addToCart([{ variant: almonds, qty: 1 }]);
    await applyPromoCode(a, 'LASTONE');
    await applyPromoCode(b, 'LASTONE');

    await checkout(a, cityId);
    await expect(checkout(b, cityId)).rejects.toThrow('Your cart has changed');
    expect((await getCart(b)).promoCode).toBeNull();
  });

  it('two checkouts at the same moment cannot both take the last use', async () => {
    const { cityId, almonds } = await store();
    await promo({ name: 'TEST', type: 'code', code: 'RACE', discountType: 'fixed', value: 100, usageLimit: 1 });
    const a = await addToCart([{ variant: almonds, qty: 1 }]);
    const b = await addToCart([{ variant: almonds, qty: 1 }]);
    await applyPromoCode(a, 'RACE');
    await applyPromoCode(b, 'RACE');

    const results = await Promise.allSettled([checkout(a, cityId), checkout(b, cityId)]);
    const discounted = results.filter((r) => r.status === 'fulfilled' && r.value.promotion);
    expect(discounted).toHaveLength(1);
    expect((await Promotion.findOne({ code: 'RACE' }))!.usageCount).toBe(1);
  });

  it('cancelling the order gives the code use back', async () => {
    const { cityId, almonds } = await store();
    await promo({ name: 'TEST', type: 'code', code: 'GIVEBACK', discountType: 'fixed', value: 100, usageLimit: 1, perCustomerLimit: 1 });
    const phone = nextPhone();
    const session = await addToCart([{ variant: almonds, qty: 1 }]);
    await applyPromoCode(session, 'GIVEBACK');
    const placed = await checkout(session, cityId, phone);

    await cancelOrder(placed.orderNumber, { reason: 'TEST changed mind' }, actor);
    expect((await Promotion.findOne({ code: 'GIVEBACK' }))!.usageCount).toBe(0);
    expect(await PromotionRedemption.countDocuments({ status: 'released' })).toBe(1);

    const again = await addToCart([{ variant: almonds, qty: 1 }]);
    await applyPromoCode(again, 'GIVEBACK');
    await expect(checkout(again, cityId, phone)).resolves.toMatchObject({ promotion: { code: 'GIVEBACK' } });
  });

  it('a refund can never be more than the discounted price paid', async () => {
    const { cityId, almonds } = await store();
    await promo({ name: 'TEST', type: 'code', code: 'HALF', discountType: 'percent', value: 50 });
    const session = await addToCart([{ variant: almonds, qty: 1 }]);
    await applyPromoCode(session, 'HALF');
    const placed = await checkout(session, cityId);
    await logCallConfirmAndDeliver(placed.orderNumber);

    await expect(
      createRefund({ order: placed.orderNumber, reason: 'damaged', description: 'TEST jar cracked', items: [{ variantId: almonds.id, qty: 1, amount: 600 }] }, actor)
    ).rejects.toThrow(/cannot be more than Rs 500/);
  });

  it('HTTP: apply and remove a code with the cart cookie', async () => {
    const { almonds } = await store();
    await promo({ name: 'TEST', type: 'code', code: 'HTTPTEST', discountType: 'fixed', value: 50 });
    const agent = request.agent(app);
    await agent.post('/api/cart/items').send({ variantId: almonds.id, quantity: 1 }).expect(201);

    const applied = await agent.post('/api/cart/promo-code').send({ code: 'httptest' });
    expect(applied.status).toBe(200);
    expect(applied.body.cart).toMatchObject({ discountTotal: 50, promoCode: { code: 'HTTPTEST', applied: true } });

    const removed = await agent.delete('/api/cart/promo-code');
    expect(removed.body.cart).toMatchObject({ discountTotal: 0, promoCode: null });
  });
});