import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 20B: PostEx bookings. PostEx is never called for real: fetch is replaced by a fake
// that answers like the PostEx guide shows. All data below is FICTIONAL.
process.env.POSTEX_TOKEN = 'test-postex-token-FICTIONAL';
process.env.POSTEX_ENV = 'uat';

const { default: app } = await import('../src/app.js');
const { default: Admin } = await import('../src/models/Admin.js');
const { default: City } = await import('../src/models/City.js');
const { default: Setting, SETTINGS_ID } = await import('../src/models/Setting.js');
const { default: IntegrationLog } = await import('../src/models/IntegrationLog.js');
const fx = await import('./helpers/fixtures.js');
const { logCall } = await import('../src/modules/orders/order.service.js');
const { packOrder, unpackOrder } = await import('../src/modules/orders/packing.service.js');
const { shipOrder } = await import('../src/modules/orders/fulfillment.service.js');
const booking = await import('../src/modules/integrations/postex/postexBooking.service.js');

type Call = { method: string; url: string; body?: Record<string, unknown> };
type FakeReply = { status?: number; body?: unknown; pdf?: boolean };
type Answer = FakeReply | 'timeout' | (() => FakeReply);
const calls: Call[] = [];
let answers: Record<string, Answer>;
let trackingCount = 0;

const ok = (dist: unknown, statusMessage = 'SUCCESSFULLY OPERATED') => ({ body: { statusCode: '200', statusMessage, dist } });

beforeEach(() => {
  calls.length = 0;
  trackingCount = 0;
  answers = {
    // A new tracking number for every booking: CX-TEST1, CX-TEST2…
    'create-order': () => ok({ trackingNumber: `CX-TEST${++trackingCount}`, orderStatus: 'UnBooked', orderDate: '2026-11-26 10:00:00' }, 'ORDER HAS BEEN CREATED'),
    'get-unbooked-orders': ok([]),
    'cancel-order': { status: 200, body: '' },
    getinvoice: { pdf: true },
    'generate-load-sheet': { pdf: true },
    'get-operational-city': ok([
      { operationalCityName: 'Lahore', isPickupCity: 'true', isDeliveryCity: 'true' },
      { operationalCityName: 'Rawalpindi', isPickupCity: 'true', isDeliveryCity: 'true' },
      { operationalCityName: 'Muzaffargarh', isPickupCity: 'false', isDeliveryCity: 'true' },
    ]),
  };
  vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(answers).find((k) => url.includes(k));
    const found = key ? answers[key]! : { status: 404, body: { statusCode: '404', statusMessage: 'NOT FOUND' } };
    const answer = typeof found === 'function' ? found() : found;
    if (answer === 'timeout') throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    if (answer.pdf) return new Response(Buffer.from('%PDF-1.4 TEST'), { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    const text = typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body);
    return new Response(text, { status: answer.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
});

afterEach(() => vi.unstubAllGlobals());

// A store whose Lahore is matched to PostEx, with pickup address 050, and an order in Packing
async function packedOrder(opts: { matched?: boolean } = {}) {
  const store = await fx.createStore();
  await City.updateOne({ _id: store.city._id }, { $set: { postex: { name: 'LAHORE', delivers: opts.matched ?? true, manual: false, checkedAt: new Date() } } });
  await Setting.updateOne({ _id: SETTINGS_ID }, { $set: { 'postex.pickupAddressCode': '050' } });
  const size = await fx.createVariant(store.product._id, { price: 1000, weightGrams: 300 });
  await fx.receive(size, 'TEST-PX-1', 20, 300);
  const { orderNumber } = await fx.order([{ variant: size, qty: 2 }], store.cityId, '03001234567');
  await logCall(orderNumber, { outcome: 'confirmed' }, fx.actor);
  await packOrder(orderNumber, {}, fx.actor);
  return { orderNumber, store, size };
}

const bookingCalls = () => calls.filter((c) => c.url.includes('create-order'));

describe('Booking a parcel', () => {
  it('books with the customer details PostEx asks for and saves the tracking number', async () => {
    const { orderNumber } = await packedOrder();
    const res = await booking.bookParcel(orderNumber, fx.actor);

    expect(res.booking).toMatchObject({ provider: 'postex', status: 'booked', trackingNumber: 'CX-TEST1', weightKg: 0.6 });
    expect(bookingCalls()).toHaveLength(1);
    const body = bookingCalls()[0]!.body!;
    const order = await fx.findOrder(orderNumber);
    expect(body).toMatchObject({
      orderRefNumber: orderNumber,
      invoicePayment: order!.pricing.total, // COD: the rider collects the full total
      customerPhone: '03001234567',
      cityName: 'LAHORE', // PostEx's own spelling
      invoiceDivision: 1,
      items: 2,
      orderType: 'Normal',
      bookingWeight: 0.6,
      pickupAddressCode: '050',
    });
    expect(String(body.orderDetail)).toContain('2 x TEST Almonds');
    // Booked is not shipped: the order stays in Packing until the rider takes it
    expect(order!.status).toBe('packing');
    expect(await IntegrationLog.countDocuments({ action: 'book_shipment', status: 'success', orderNumber })).toBe(1);
  });

  it('refuses a second booking, and two clicks at once book only one parcel', async () => {
    const { orderNumber } = await packedOrder();
    const results = await Promise.allSettled([booking.bookParcel(orderNumber, fx.actor), booking.bookParcel(orderNumber, fx.actor)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(bookingCalls()).toHaveLength(1);
    await expect(booking.bookParcel(orderNumber, fx.actor)).rejects.toThrow(/Already booked with PostEx: CX-TEST1/);
  });

  it('only books orders in Packing, to a matched city, with a pickup address', async () => {
    const { orderNumber } = await packedOrder({ matched: false });
    await expect(booking.bookParcel(orderNumber, fx.actor)).rejects.toThrow(/PostEx does not deliver to Lahore/);

    await Setting.updateOne({ _id: SETTINGS_ID }, { $unset: { 'postex.pickupAddressCode': '' } });
    await expect(booking.bookParcel(orderNumber, fx.actor)).rejects.toThrow(/pickup address/);
    expect(bookingCalls()).toHaveLength(0);
  });

  it('a refusal from PostEx is "failed" and can be booked again after fixing', async () => {
    const { orderNumber } = await packedOrder();
    answers['create-order'] = { status: 400, body: { statusCode: '400', statusMessage: 'INVALID CUSTOMER PHONE' } };
    await expect(booking.bookParcel(orderNumber, fx.actor)).rejects.toThrow(/PostEx said: INVALID CUSTOMER PHONE/);
    expect((await fx.findOrder(orderNumber))!.fulfillment.booking).toMatchObject({ status: 'failed', error: expect.stringContaining('INVALID') });

    answers['create-order'] = ok({ trackingNumber: 'CX-TEST-AGAIN' });
    const res = await booking.bookParcel(orderNumber, fx.actor);
    expect(res.booking).toMatchObject({ status: 'booked', trackingNumber: 'CX-TEST-AGAIN' });
  });

  it('no answer = "unknown"; the next try finds the parcel PostEx made instead of booking twice', async () => {
    const { orderNumber } = await packedOrder();
    answers['create-order'] = 'timeout';
    await expect(booking.bookParcel(orderNumber, fx.actor)).rejects.toThrow(/may or may not have created the parcel/);
    expect((await fx.findOrder(orderNumber))!.fulfillment.booking!.status).toBe('unknown');

    // Shipping and unpacking wait until we know
    await expect(shipOrder(orderNumber, { courier: 'postex', trackingNumber: 'CX-TYPED' }, fx.actor)).rejects.toThrow(/not finished/);
    await expect(unpackOrder(orderNumber, { reason: 'TEST' }, fx.actor)).rejects.toThrow(/Cancel the PostEx booking first/);

    answers['get-unbooked-orders'] = ok([{ orderRefNumber: 'SOMEONE-ELSE', trackingNumber: 'CX-OTHER' }, { orderRefNumber: orderNumber, trackingNumber: 'CX-MADE-ANYWAY' }]);
    answers['create-order'] = ok({ trackingNumber: 'CX-SHOULD-NOT-HAPPEN' });
    const res = await booking.bookParcel(orderNumber, fx.actor);
    expect(res).toMatchObject({ foundEarlierBooking: true, booking: { status: 'booked', trackingNumber: 'CX-MADE-ANYWAY' } });
    expect(bookingCalls()).toHaveLength(1); // only the first (timed-out) attempt
    const lookup = calls.find((c) => c.url.includes('get-unbooked-orders'))!;
    expect(lookup.url).toMatch(/startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}/);
  });

  it('no answer and nothing at PostEx: the next try books normally', async () => {
    const { orderNumber } = await packedOrder();
    answers['create-order'] = { status: 503, body: 'Service Unavailable' };
    await expect(booking.bookParcel(orderNumber, fx.actor)).rejects.toThrow(/may or may not/);
    answers['create-order'] = ok({ trackingNumber: 'CX-SECOND-TRY' });
    const res = await booking.bookParcel(orderNumber, fx.actor);
    expect(res).toMatchObject({ foundEarlierBooking: false, booking: { trackingNumber: 'CX-SECOND-TRY' } });
  });
});

describe('Shipping a PostEx order', () => {
  it('uses the booked tracking number', async () => {
    const { orderNumber } = await packedOrder();
    await booking.bookParcel(orderNumber, fx.actor);
    const { order } = await shipOrder(orderNumber, { courier: 'postex' }, fx.actor);
    expect(order.status).toBe('shipped');
    expect(order.fulfillment.trackingNumber).toBe('CX-TEST1');
  });

  it('refuses another courier or a different number while booked', async () => {
    const { orderNumber } = await packedOrder();
    await booking.bookParcel(orderNumber, fx.actor);
    await expect(shipOrder(orderNumber, { courier: 'tcs', trackingNumber: 'TCS123' }, fx.actor)).rejects.toThrow(/Ship it with PostEx/);
    await expect(shipOrder(orderNumber, { courier: 'postex', trackingNumber: 'CX-WRONG' }, fx.actor)).rejects.toThrow(/booked with PostEx as CX-TEST1/);
  });

  it('PostEx down: a number typed from the PostEx portal still works (no booking made here)', async () => {
    const { orderNumber } = await packedOrder();
    await expect(shipOrder(orderNumber, { courier: 'postex' }, fx.actor)).rejects.toThrow(/Book the parcel with PostEx first/);
    const { order } = await shipOrder(orderNumber, { courier: 'postex', trackingNumber: 'CX-PORTAL-1' }, fx.actor);
    expect(order.fulfillment.trackingNumber).toBe('CX-PORTAL-1');
  });
});

describe('Cancelling a booking', () => {
  it('cancels at PostEx, then the order can be unpacked or booked again', async () => {
    const { orderNumber } = await packedOrder();
    await booking.bookParcel(orderNumber, fx.actor);
    await expect(unpackOrder(orderNumber, { reason: 'TEST' }, fx.actor)).rejects.toThrow(/Cancel the PostEx booking first/);

    const res = await booking.cancelBooking(orderNumber, { reason: 'TEST customer changed address' }, fx.actor);
    expect(res.booking).toMatchObject({ status: 'cancelled', trackingNumber: 'CX-TEST1' });
    const cancel = calls.find((c) => c.url.includes('cancel-order'))!;
    expect(cancel).toMatchObject({ method: 'PUT', body: { trackingNumber: 'CX-TEST1' } });

    const again = await booking.bookParcel(orderNumber, fx.actor);
    expect(again.booking).toMatchObject({ status: 'booked', trackingNumber: 'CX-TEST2' });
    await booking.cancelBooking(orderNumber, { reason: 'TEST again' }, fx.actor);
    await unpackOrder(orderNumber, { reason: 'TEST wrong box' }, fx.actor);
    expect((await fx.findOrder(orderNumber))!.status).toBe('confirmed');
  });

  it('cannot cancel after the parcel is shipped; PostEx "not found" is shown', async () => {
    const { orderNumber } = await packedOrder();
    await booking.bookParcel(orderNumber, fx.actor);
    answers['cancel-order'] = { status: 404, body: { statusCode: '404', statusMessage: 'ORDER NOT FOUND' } };
    await expect(booking.cancelBooking(orderNumber, { reason: 'TEST' }, fx.actor)).rejects.toThrow(/ORDER NOT FOUND/);
    expect((await fx.findOrder(orderNumber))!.fulfillment.booking!.status).toBe('booked');

    await shipOrder(orderNumber, { courier: 'postex' }, fx.actor);
    await expect(booking.cancelBooking(orderNumber, { reason: 'TEST' }, fx.actor)).rejects.toThrow(/already with PostEx/);
  });
});

describe('Labels, load sheet, city suggestions (admin API)', () => {
  async function loggedIn() {
    await Admin.create({ name: 'Test Admin (FICTIONAL)', email: 'postex.booking@example.com', passwordHash: await bcrypt.hash('test-password-123', 4) });
    const agent = request.agent(app);
    await agent.post('/api/admin/auth/login').send({ email: 'postex.booking@example.com', password: 'test-password-123' }).expect(200);
    return agent;
  }

  it('book, airway bill and load sheet over HTTP; admin only', async () => {
    const { orderNumber } = await packedOrder();
    await request(app).post(`/api/admin/integrations/postex/orders/${orderNumber}/book`).expect(401);

    const agent = await loggedIn();
    await agent.get(`/api/admin/integrations/postex/orders/${orderNumber}/airway-bill`).expect(409);
    const booked = await agent.post(`/api/admin/integrations/postex/orders/${orderNumber}/book`).expect(200);
    expect(booked.body.booking.trackingNumber).toBe('CX-TEST1');

    const label = await agent.get(`/api/admin/integrations/postex/orders/${orderNumber}/airway-bill`).expect(200);
    expect(label.headers['content-type']).toContain('application/pdf');
    expect(calls.find((c) => c.url.includes('getinvoice'))!.url).toContain('trackingNumbers=CX-TEST1');

    const sheet = await agent.post('/api/admin/integrations/postex/load-sheet').send({}).expect(200);
    expect(sheet.headers['content-disposition']).toContain('postex-load-sheet-');
    expect(calls.find((c) => c.url.includes('generate-load-sheet'))!.body).toEqual({ trackingNumbers: ['CX-TEST1'] });

    const bad = await agent.post('/api/admin/integrations/postex/load-sheet').send({ orders: ['HS-NOT-BOOKED'] }).expect(400);
    expect(bad.body.message).toMatch(/Not booked with PostEx: HS-NOT-BOOKED/);
  });

  it('suggests the closest PostEx spelling for unmatched cities', async () => {
    await City.create([
      { name: 'Rawalpindi', province: 'Punjab' },
      { name: 'Muzafargarh', province: 'Punjab' },
      { name: 'Astore', province: 'Gilgit-Baltistan' },
    ]);
    const agent = await loggedIn();
    const res = await agent.get('/api/admin/integrations/postex/city-suggestions').expect(200);
    const byName = Object.fromEntries(res.body.cities.map((c: { name: string; suggestions: unknown[] }) => [c.name, c.suggestions]));
    expect(byName['Rawalpindi'][0]).toEqual({ postexCityName: 'Rawalpindi', score: 1 });
    expect(byName['Muzafargarh'][0].postexCityName).toBe('Muzaffargarh');
    expect(byName['Astore']).toEqual([]);
  });
});