import { describe, expect, it } from 'vitest';
import { cancelOrder, logCall } from '../src/modules/orders/order.service.js';
import { packOrder, unpackOrder } from '../src/modules/orders/packing.service.js';
import { deliverOrder, failDelivery, returnOrder, shipOrder } from '../src/modules/orders/fulfillment.service.js';
import StockMovement from '../src/models/StockMovement.js';
import { actor, batchLeft, createStore, createVariant, findOrder, order, receive, stockOf } from './helpers/fixtures.js';

describe('COD confirmation calls', () => {
  it('three unanswered calls move the order through the attempts, then it can be cancelled', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 5, 200);
    const { orderNumber } = await order([{ variant: size, qty: 2 }], cityId);

    await logCall(orderNumber, { outcome: 'no_answer' }, actor);
    await logCall(orderNumber, { outcome: 'busy' }, actor);
    const third = await logCall(orderNumber, { outcome: 'switched_off' }, actor);
    expect(third.order.status).toBe('contact_attempt_3');
    expect(third.canCancelForNoAnswer).toBe(true);

    // A fourth unanswered call is refused
    await expect(logCall(orderNumber, { outcome: 'no_answer' }, actor)).rejects.toThrow(/Three calls/);

    await cancelOrder(orderNumber, { reason: 'TEST no answer after 3 calls' }, actor);
    expect((await findOrder(orderNumber)).status).toBe('cancelled');
    expect(await stockOf(size)).toEqual({ available: 5, reserved: 0 });
  });

  it('an order cannot be packed before the call confirms it', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 5, 200);
    const { orderNumber } = await order([{ variant: size, qty: 1 }], cityId);

    await expect(packOrder(orderNumber, {}, actor)).rejects.toThrow(/cannot be changed to "Packing"/);
  });

  it('a confirmed call marks the order Confirmed', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 5, 200);
    const { orderNumber } = await order([{ variant: size, qty: 1 }], cityId);

    await logCall(orderNumber, { outcome: 'no_answer' }, actor);
    const result = await logCall(orderNumber, { outcome: 'confirmed' }, actor);
    expect(result.order.status).toBe('confirmed');
  });
});

describe('Packing and batch selection', () => {
  it('suggested packing takes the batch that expires first', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    const late = await receive(size, 'LATE', 10, 300);
    const early = await receive(size, 'EARLY', 10, 100);
    const { orderNumber } = await order([{ variant: size, qty: 3 }], cityId);
    await logCall(orderNumber, { outcome: 'confirmed' }, actor);

    const { order: packed } = await packOrder(orderNumber, {}, actor);

    expect(packed.status).toBe('packing');
    expect(packed.items[0]?.batchAllocations.map((a) => [a.batchNumber, a.qty])).toEqual([['EARLY', 3]]);
    expect(await batchLeft(early.id)).toBe(7);
    expect(await batchLeft(late.id)).toBe(10);
    // The reservation became real stock taken out of the batch
    expect(await stockOf(size)).toEqual({ available: 17, reserved: 0 });
  });

  it('the admin can choose batches, and undoing packing puts every unit back', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    const a = await receive(size, 'A', 2, 300);
    const b = await receive(size, 'B', 10, 100);
    const { orderNumber } = await order([{ variant: size, qty: 4 }], cityId);
    await logCall(orderNumber, { outcome: 'confirmed' }, actor);

    await packOrder(orderNumber, { items: [{ variantId: size.id, allocations: [{ batchId: a.id, qty: 2 }, { batchId: b.id, qty: 2 }] }] }, actor);
    expect(await batchLeft(a.id)).toBe(0);
    expect(await batchLeft(b.id)).toBe(8);

    await unpackOrder(orderNumber, { reason: 'TEST wrong box' }, actor);
    expect(await batchLeft(a.id)).toBe(2);
    expect(await batchLeft(b.id)).toBe(10);
    expect((await findOrder(orderNumber)).status).toBe('confirmed');
    expect(await stockOf(size)).toEqual({ available: 8, reserved: 4 });
  });

  it('chosen batches must add up to the ordered quantity', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    const a = await receive(size, 'A', 10, 300);
    const { orderNumber } = await order([{ variant: size, qty: 3 }], cityId);
    await logCall(orderNumber, { outcome: 'confirmed' }, actor);

    await expect(
      packOrder(orderNumber, { items: [{ variantId: size.id, allocations: [{ batchId: a.id, qty: 2 }] }] }, actor)
    ).rejects.toThrow(/add up to 2/);
    expect(await batchLeft(a.id)).toBe(10); // nothing changed
  });
});

describe('Courier, delivery and returns', () => {
  async function packedOrder(qty = 2) {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    const batch = await receive(size, 'B1', 10, 200);
    const { orderNumber } = await order([{ variant: size, qty }], cityId);
    await logCall(orderNumber, { outcome: 'confirmed' }, actor);
    await packOrder(orderNumber, {}, actor);
    return { size, batch, orderNumber };
  }

  it('shipping needs a courier and a tracking number; delivery records the COD collected', async () => {
    const { orderNumber } = await packedOrder();

    await expect(shipOrder(orderNumber, { trackingNumber: 'TCS1234' }, actor)).rejects.toThrow('Choose the courier');
    await expect(shipOrder(orderNumber, { courier: 'tcs' }, actor)).rejects.toThrow(/Enter the TCS tracking number/);

    await shipOrder(orderNumber, { courier: 'tcs', trackingNumber: 'TCS1234' }, actor);
    const shipped = await findOrder(orderNumber);
    expect(shipped.status).toBe('shipped');
    expect(shipped.fulfillment.courier).toBe('tcs');
    expect(shipped.fulfillment.trackingNumber).toBe('TCS1234');

    await deliverOrder(orderNumber, {}, actor);
    const delivered = await findOrder(orderNumber);
    expect(delivered.status).toBe('delivered');
    expect(delivered.payment.status).toBe('collected');
    expect(delivered.payment.amountCollected).toBe(delivered.pricing.total);
  });

  it('the same tracking number cannot be used on two orders', async () => {
    const first = await packedOrder();
    await shipOrder(first.orderNumber, { courier: 'tcs', trackingNumber: 'DUP1234' }, actor);

    const { orderNumber } = await order([{ variant: first.size, qty: 1 }], (await findOrder(first.orderNumber)).customerSnapshot.address.cityRef!.toString());
    await logCall(orderNumber, { outcome: 'confirmed' }, actor);
    await packOrder(orderNumber, {}, actor);
    await expect(shipOrder(orderNumber, { courier: 'tcs', trackingNumber: 'DUP1234' }, actor)).rejects.toThrow(/already used/);
  });

  it('a refused parcel can be returned and restocked into the same batch', async () => {
    const { size, batch, orderNumber } = await packedOrder(2);
    await shipOrder(orderNumber, { courier: 'leopards', trackingNumber: 'LP5555' }, actor);
    await failDelivery(orderNumber, { reason: 'refused' }, actor);
    expect((await findOrder(orderNumber)).payment.status).toBe('refused');

    await returnOrder(orderNumber, { items: [{ variantId: size.id, decision: 'restock' }] }, actor);

    expect((await findOrder(orderNumber)).status).toBe('returned');
    expect(await batchLeft(batch.id)).toBe(10);
    expect(await stockOf(size)).toEqual({ available: 10, reserved: 0 });
  });

  it('a damaged returned parcel can be written off (stock does not come back)', async () => {
    const { size, batch, orderNumber } = await packedOrder(2);
    await shipOrder(orderNumber, { courier: 'postex', trackingNumber: 'PX7777' }, actor);
    await failDelivery(orderNumber, { reason: 'uncollected' }, actor);

    await returnOrder(orderNumber, { items: [{ variantId: size.id, decision: 'write_off', reason: 'TEST box crushed' }] }, actor);

    expect(await batchLeft(batch.id)).toBe(8);
    expect(await StockMovement.countDocuments({ type: 'return_written_off', variant: size._id })).toBe(1);
  });
});