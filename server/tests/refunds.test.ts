import { describe, expect, it } from 'vitest';
import Customer from '../src/models/Customer.js';
import { approveRefund, createRefund, payRefund, rejectRefund } from '../src/modules/refunds/refund.service.js';
import { payRefundSchema } from '../src/modules/refunds/refund.validation.js';
import { actor, createStore, createVariant, deliveredOrder, findOrder, order, receive } from './helpers/fixtures.js';

async function setup() {
  const { product, cityId } = await createStore({ deliveryCharge: 200 });
  const size = await createVariant(product._id, { price: 1000 });
  await receive(size, 'B1', 10, 200);
  const orderNumber = await deliveredOrder([{ variant: size, qty: 2 }], cityId); // Rs 2000 + Rs 200 delivery
  return { size, cityId, orderNumber };
}

describe('Refunds (damaged or incorrect only)', () => {
  it('only delivered orders can have a refund', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 5, 200);
    const { orderNumber } = await order([{ variant: size, qty: 1 }], cityId);

    await expect(
      createRefund({ order: orderNumber, reason: 'damaged', description: 'TEST jar cracked', items: [{ variantId: size.id, qty: 1 }] }, actor)
    ).rejects.toThrow(/only for delivered orders/);
  });

  it('a refund cannot be more than what was paid for the item', async () => {
    const { size, orderNumber } = await setup();
    await expect(
      createRefund({ order: orderNumber, reason: 'damaged', description: 'TEST jar cracked', items: [{ variantId: size.id, qty: 1, amount: 1500 }] }, actor)
    ).rejects.toThrow(/cannot be more than Rs 1000/);
  });

  it('record -> approve -> pay: order Refunded, payment partly refunded, customer total reduced', async () => {
    const { size, orderNumber } = await setup();
    const before = await findOrder(orderNumber);
    const spentBefore = (await Customer.findById(before.customer).lean())!.stats.totalSpent;

    const { refund } = await createRefund(
      { order: orderNumber, reason: 'damaged', description: 'TEST jar cracked', items: [{ variantId: size.id, qty: 1 }] },
      actor
    );
    expect(refund.amount).toBe(1000);

    // Only one open refund per order
    await expect(
      createRefund({ order: orderNumber, reason: 'incorrect', description: 'TEST wrong size', items: [{ variantId: size.id, qty: 1 }] }, actor)
    ).rejects.toThrow(/already has an open refund/);

    await approveRefund(refund.id, actor);
    expect((await findOrder(orderNumber)).status).toBe('refund_pending');

    const paid = await payRefund(refund.id, payRefundSchema.parse({ payoutMethod: 'TEST bank transfer', payoutReference: 'TX-123' }), actor);
    expect(paid.refund.status).toBe('paid');

    const after = await findOrder(orderNumber);
    expect(after.status).toBe('refunded');
    expect(after.payment.status).toBe('partially_refunded');
    expect((await Customer.findById(after.customer).lean())!.stats.totalSpent).toBe(spentBefore - 1000);
  });

  it('rejecting an approved refund moves the order back to Delivered', async () => {
    const { size, orderNumber } = await setup();
    const { refund } = await createRefund(
      { order: orderNumber, reason: 'incorrect', description: 'TEST wrong size sent', items: [{ variantId: size.id, qty: 1 }] },
      actor
    );
    await approveRefund(refund.id, actor);
    await rejectRefund(refund.id, { reason: 'TEST photo shows correct item' }, actor);

    expect((await findOrder(orderNumber)).status).toBe('delivered');
  });

  it('card or account numbers are never accepted in payout details', () => {
    const result = payRefundSchema.safeParse({ payoutMethod: 'Bank', payoutReference: '4111 1111 1111 1111' });
    expect(result.success).toBe(false);
  });
});