import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import AuditLog from '../src/models/AuditLog.js';
import { changePromotionStatus, createPromotion, listPromotions, updatePromotion } from '../src/modules/promotions/promotion.service.js';
import { createPromotionSchema, updatePromotionSchema } from '../src/modules/promotions/promotion.validation.js';
import { actor, createStore, pktDay } from './helpers/fixtures.js';

const create = (input: unknown) => createPromotion(createPromotionSchema.parse(input), actor);
const errors = (input: unknown) => createPromotionSchema.safeParse(input).error?.issues.map((i) => i.message) ?? [];

describe('Admin: create promotions', () => {
  it('creates a discount code (stored in capitals)', async () => {
    const promo = await create({ name: 'TEST Eid code', type: 'code', code: 'eid10', discountType: 'percent', value: 10, usageLimit: 100, perCustomerLimit: 1 });
    expect(promo).toMatchObject({ code: 'EID10', live: true, state: 'Running', wholeStore: true, usageCount: 0 });
    expect(await AuditLog.countDocuments({ action: 'promotion.create' })).toBe(1);
  });

  it('the same code cannot be used twice', async () => {
    await create({ name: 'TEST one', type: 'code', code: 'SAVE', discountType: 'fixed', value: 100 });
    await expect(create({ name: 'TEST two', type: 'code', code: 'save', discountType: 'fixed', value: 200 })).rejects.toThrow(/already used/);
  });

  it('checks the rules for each type', () => {
    expect(errors({ name: 'X1', type: 'code', discountType: 'percent', value: 10 })).toContain('Enter the code customers will type');
    expect(errors({ name: 'X1', type: 'product', discountType: 'percent', value: 10 })).toContain('Choose at least one product');
    expect(errors({ name: 'X1', type: 'seasonal', discountType: 'percent', value: 10 })).toContain('A seasonal promotion needs an end date');
    expect(errors({ name: 'X1', type: 'code', code: 'ABC', discountType: 'percent', value: 120 })).toContain('A percentage cannot be more than 100');
    expect(errors({ name: 'X1', type: 'seasonal', discountType: 'fixed', value: 50, endsOn: pktDay(5), minOrderTotal: 1000 })).toContain('A minimum order is only for discount codes');
    expect(errors({ name: 'X1', type: 'welcome', discountType: 'percent', value: 10 })).toContain('Welcome discounts come with customer accounts (Release 2)');
    expect(errors({ name: 'X1', type: 'code', code: 'ABC', audience: 'members', discountType: 'percent', value: 10 })).toContain('Members-only offers come with customer accounts (Release 2)');
    expect(errors({ name: 'X1', type: 'code', code: 'ABC', discountType: 'fixed', value: 10, maxDiscount: 5 })).toContain('A maximum discount is only for percentage codes');
  });

  it('a product promotion must point to real products', async () => {
    await createStore();
    await expect(
      create({ name: 'TEST', type: 'product', discountType: 'percent', value: 10, products: ['0123456789abcdef01234567'] })
    ).rejects.toThrow(/not found/);
  });

  it('a promotion that starts later is scheduled, not live', async () => {
    const promo = await create({ name: 'TEST later', type: 'seasonal', discountType: 'percent', value: 5, startsOn: pktDay(3), endsOn: pktDay(10) });
    expect(promo.live).toBe(false);
    expect(promo.state).toMatch(/^Starts /);
    expect(promo.endsOn).toBe(pktDay(10)); // the last day, as typed
  });
});

describe('Admin: change promotions', () => {
  it('edits are checked with the same rules', async () => {
    const promo = await create({ name: 'TEST', type: 'code', code: 'TEN', discountType: 'percent', value: 10 });
    const edited = await updatePromotion(promo.id, updatePromotionSchema.parse({ value: 15, usageLimit: 50 }), actor);
    expect(edited).toMatchObject({ value: 15, usageLimit: 50 });

    await expect(updatePromotion(promo.id, updatePromotionSchema.parse({ value: 150 }), actor)).rejects.toThrow('Please check the promotion');
  });

  it('pause, resume, end (end is final)', async () => {
    const promo = await create({ name: 'TEST', type: 'code', code: 'PAUSE1', discountType: 'fixed', value: 100 });
    expect((await changePromotionStatus(promo.id, 'pause', actor)).live).toBe(false);
    expect((await changePromotionStatus(promo.id, 'resume', actor)).live).toBe(true);
    await changePromotionStatus(promo.id, 'end', actor);
    await expect(changePromotionStatus(promo.id, 'resume', actor)).rejects.toThrow(/cannot be resumed/);
    await expect(updatePromotion(promo.id, updatePromotionSchema.parse({ value: 50 }), actor)).rejects.toThrow(/ended promotion cannot be changed/);
  });

  it('the list can be searched by name or code', async () => {
    await create({ name: 'TEST Winter', type: 'code', code: 'WINTER', discountType: 'percent', value: 10 });
    await create({ name: 'TEST Summer', type: 'code', code: 'SUMMER', discountType: 'percent', value: 10 });
    expect((await listPromotions({ search: 'wint', page: 1, limit: 20 })).total).toBe(1);
  });

  it('admin promotion routes need a login', async () => {
    expect((await request(app).get('/api/admin/promotions')).status).toBe(401);
    expect((await request(app).post('/api/admin/promotions').send({})).status).toBe(401);
  });
});
