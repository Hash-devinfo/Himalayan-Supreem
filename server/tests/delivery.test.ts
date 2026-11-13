import { describe, expect, it } from 'vitest';
import City from '../src/models/City.js';
import DeliveryZone from '../src/models/DeliveryZone.js';
import Setting from '../src/models/Setting.js';
import { chargeForWeight } from '../src/modules/delivery/quote.service.js';
import { addToCart, checkout, createStore, createVariant, order, receive } from './helpers/fixtures.js';

describe('Delivery charge and order totals', () => {
  it('weight bands pick the right charge', () => {
    const zone = { charge: 250, weightRules: [{ upToGrams: 1000, charge: 200 }, { upToGrams: 3000, charge: 350 }] };
    expect(chargeForWeight(zone, 800)).toBe(200);
    expect(chargeForWeight(zone, 1000)).toBe(200);
    expect(chargeForWeight(zone, 2500)).toBe(350);
    expect(chargeForWeight(zone, 9000)).toBe(350); // heavier than every band: the last band
    expect(chargeForWeight({ charge: 250, weightRules: [] }, 9000)).toBe(250); // flat rate
  });

  it('total = items + delivery charge, with prices taken from the database', async () => {
    const { product, cityId } = await createStore({ deliveryCharge: 250 });
    const small = await createVariant(product._id, { price: 1200 });
    const large = await createVariant(product._id, { price: 4500 });
    await receive(small, 'S1', 10, 200);
    await receive(large, 'L1', 10, 200);

    const placed = await order([{ variant: small, qty: 2 }, { variant: large, qty: 1 }], cityId);

    expect(placed.pricing).toEqual({ subtotal: 6900, discountTotal: 0, deliveryCharge: 250, total: 7150 });
    expect(placed.paymentMethod).toBe('cod');
  });

  it('delivery is free at or above the free-delivery amount', async () => {
    const { product, cityId } = await createStore({ deliveryCharge: 250 });
    const size = await createVariant(product._id, { price: 2500 });
    await receive(size, 'B1', 10, 200);
    await Setting.updateOne({}, { $set: { freeDeliveryThreshold: 5000 } });

    const below = await order([{ variant: size, qty: 1 }], cityId);
    const atThreshold = await order([{ variant: size, qty: 2 }], cityId);

    expect(below.pricing.deliveryCharge).toBe(250);
    expect(atThreshold.pricing).toMatchObject({ deliveryCharge: 0, total: 5000 });
  });

  it("a city's own zone is used instead of the default", async () => {
    const { product, city } = await createStore({ deliveryCharge: 250 });
    const near = await DeliveryZone.create({ name: 'TEST Same city', charge: 150, estimateText: 'TEST 1-2 working days', active: true });
    await City.updateOne({ _id: city._id }, { $set: { zone: near._id } });
    const size = await createVariant(product._id, { price: 1000 });
    await receive(size, 'B1', 10, 200);

    const placed = await order([{ variant: size, qty: 1 }], city.id);
    expect(placed.pricing.deliveryCharge).toBe(150);
    expect(placed.delivery.estimateText).toBe('TEST 1-2 working days');
  });

  it('orders to a blocked city are refused and nothing is reserved', async () => {
    const { product, city } = await createStore();
    await City.updateOne({ _id: city._id }, { $set: { isBlocked: true } });
    const size = await createVariant(product._id);
    await receive(size, 'B1', 10, 200);

    const cart = await addToCart([{ variant: size, qty: 1 }]);
    await expect(checkout(cart, city.id)).rejects.toThrow(/can't deliver to Lahore/);
  });
});