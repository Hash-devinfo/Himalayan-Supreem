import { describe, expect, it } from 'vitest';
import { addItem } from '../src/modules/cart/cart.service.js';
import { recalculateVariantStock } from '../src/modules/inventory/stock.service.js';
import { receiveBatchSchema } from '../src/modules/inventory/inventory.validation.js';
import { cancelOrder } from '../src/modules/orders/order.service.js';
import { setInventoryRules } from '../src/modules/settings/inventoryRules.js';
import { DEFAULT_INVENTORY_RULES } from '../src/constants/inventory.js';
import { actor, addToCart, checkout, createStore, createVariant, oldBatch, order, pktDay, receive, stockOf } from './helpers/fixtures.js';

describe('Stock reservation (variant level)', () => {
  it('placing an order reserves stock for that size', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 10, 200);

    await order([{ variant: size, qty: 3 }], cityId);

    expect(await stockOf(size)).toEqual({ available: 7, reserved: 3 });
  });

  it('each size keeps its own stock', async () => {
    const { product, cityId } = await createStore();
    const small = await createVariant(product._id, { label: '250 g' });
    const large = await createVariant(product._id, { label: '1 kg', price: 3500 });
    await receive(small, 'S1', 5, 200);
    await receive(large, 'L1', 2, 200);

    await order([{ variant: large, qty: 2 }], cityId);

    expect(await stockOf(small)).toEqual({ available: 5, reserved: 0 });
    expect(await stockOf(large)).toEqual({ available: 0, reserved: 2 });
  });

  it('a customer cannot put more than the available stock in the cart', async () => {
    const { product } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 2, 200);

    await expect(addItem(undefined, { variantId: size.id, quantity: 3 })).rejects.toThrow(/2/);
  });

  it('when another order takes the stock first, the second checkout is refused and nothing is reserved', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 3, 200);

    // Both customers fill their carts while 3 are available
    const cartA = await addToCart([{ variant: size, qty: 2 }]);
    const cartB = await addToCart([{ variant: size, qty: 2 }]);

    await checkout(cartA, cityId);
    await expect(checkout(cartB, cityId)).rejects.toThrow(/only 1 .* left|Some items in your cart are out of stock|Your cart has changed/i);

    expect(await stockOf(size)).toEqual({ available: 1, reserved: 2 });
  });

  it('two checkouts at the same moment cannot both take the last unit', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 1, 200);

    const cartA = await addToCart([{ variant: size, qty: 1 }]);
    const cartB = await addToCart([{ variant: size, qty: 1 }]);

    const results = await Promise.allSettled([checkout(cartA, cityId), checkout(cartB, cityId)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await stockOf(size)).toEqual({ available: 0, reserved: 1 });
  });

  it('cancelling an order gives its stock back', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 5, 200);
    const { orderNumber } = await order([{ variant: size, qty: 4 }], cityId);

    await cancelOrder(orderNumber, { reason: 'TEST customer changed mind' }, actor);

    expect(await stockOf(size)).toEqual({ available: 5, reserved: 0 });
  });
});

describe('Expiry and the sell-by rule', () => {
  it('stock inside the sell-by window (7 days before expiry) is not sold', async () => {
    const { product } = await createStore();
    const size = await createVariant(product._id);
    await oldBatch(size, 'OLD1', 10, 5); // expires in 5 days

    expect(await stockOf(size)).toEqual({ available: 0, reserved: 0 });
    await expect(addItem(undefined, { variantId: size.id, quantity: 1 })).rejects.toThrow();
  });

  it('only the batches outside the window count', async () => {
    const { product } = await createStore();
    const size = await createVariant(product._id);
    await oldBatch(size, 'OLD1', 10, 5); // not sellable
    await receive(size, 'NEW1', 4, 200); // sellable

    expect(await stockOf(size)).toEqual({ available: 4, reserved: 0 });
  });

  it('a batch that expires within the window cannot be received', () => {
    const result = receiveBatchSchema.safeParse({ batchNumber: 'X1', quantity: 5, expiryDate: pktDay(3) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/cannot be sold/);
  });

  it('the window follows the setting', async () => {
    const { product } = await createStore();
    const size = await createVariant(product._id);
    await oldBatch(size, 'OLD1', 10, 5);

    setInventoryRules({ ...DEFAULT_INVENTORY_RULES, sellByCutoffDays: 3, expiryWarningDays: 60 });
    await recalculateVariantStock(size._id);
    expect(await stockOf(size)).toEqual({ available: 10, reserved: 0 });
  });
});