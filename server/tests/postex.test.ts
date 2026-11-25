import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// PostEx is never called for real: fetch is replaced by a fake that answers like the
// PostEx guide shows. All data below is FICTIONAL.
process.env.POSTEX_TOKEN = 'test-postex-token-FICTIONAL';
process.env.POSTEX_ENV = 'uat';

const { default: app } = await import('../src/app.js');
const { default: Admin } = await import('../src/models/Admin.js');
const { default: City } = await import('../src/models/City.js');
const { default: IntegrationLog } = await import('../src/models/IntegrationLog.js');
const { cityKey } = await import('../src/modules/integrations/postex/postex.service.js');

type FakeAnswer = { status?: number; body: unknown };
let answers: Record<string, FakeAnswer | (() => FakeAnswer | Promise<never>)>;
const calls: { url: string; token: string | null }[] = [];

const CITIES = {
  statusCode: '200',
  statusMessage: 'SUCCESSFULLY OPERATED',
  dist: [
    { operationalCityName: 'Lahore', countryName: 'Pakistan', isPickupCity: 'true', isDeliveryCity: 'true' },
    { operationalCityName: 'RAHIM YAR KHAN', countryName: 'Pakistan', isPickupCity: false, isDeliveryCity: true },
    { operationalCityName: 'D.G Khan', countryName: 'Pakistan', isPickupCity: 'false', isDeliveryCity: 'true' },
    { operationalCityName: 'Pickup Only Town', countryName: 'Pakistan', isPickupCity: 'true', isDeliveryCity: 'false' },
  ],
};
const ADDRESSES = {
  statusCode: '200',
  statusMessage: 'SUCCESSFULLY OPERATED',
  dist: [
    { merchantAddressId: 1, addressCode: '050', addressType: 'Pickup Address', cityName: 'LAHORE', address: 'TEST warehouse address', contactPersonName: 'TEST' },
    { merchantAddressId: 2, addressCode: '051', addressType: 'Return Address', cityName: 'LAHORE', address: 'TEST return address' },
  ],
};

beforeEach(() => {
  calls.length = 0;
  answers = { 'get-operational-city': { body: CITIES }, 'get-merchant-address': { body: ADDRESSES } };
  vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, token: (init?.headers as Record<string, string>)?.token ?? null });
    const key = Object.keys(answers).find((k) => url.includes(k));
    const answer = key ? answers[key] : { status: 404, body: { statusCode: '404', statusMessage: 'NOT FOUND' } };
    const a = typeof answer === 'function' ? await answer() : answer!;
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
});

afterEach(() => vi.unstubAllGlobals());

async function loggedIn() {
  await Admin.create({ name: 'Test Admin (FICTIONAL)', email: 'postex.admin@example.com', passwordHash: await bcrypt.hash('test-password-123', 4) });
  const agent = request.agent(app);
  // The real login must not go to the fake fetch
  await agent.post('/api/admin/auth/login').send({ email: 'postex.admin@example.com', password: 'test-password-123' }).expect(200);
  return agent;
}

async function cities() {
  await City.create([
    { name: 'Lahore', province: 'Punjab' },
    { name: 'Rahim Yar Khan', province: 'Punjab' },
    { name: 'Dera Ghazi Khan', province: 'Punjab' },
    { name: 'Gilgit', province: 'Gilgit-Baltistan' },
  ]);
}

describe('PostEx connection (reads only)', () => {
  it('status before any call: configured on the UAT server, not ready to book', async () => {
    const agent = await loggedIn();
    const res = await agent.get('/api/admin/integrations/postex');
    expect(res.body.postex).toMatchObject({ configured: true, mode: 'uat', pickupAddressCode: null, readyToBook: false });
  });

  it('check: lists cities and pickup addresses; uses the test server and sends the token in the header', async () => {
    const agent = await loggedIn();
    const res = await agent.post('/api/admin/integrations/postex/check');
    expect(res.status).toBe(200);
    expect(res.body.cities).toEqual({ total: 4, delivery: 3, pickup: 2 });
    expect(res.body.addresses.map((a: { addressCode: string }) => a.addressCode)).toEqual(['050', '051']);
    expect(calls.every((c) => c.url.startsWith('https://stg-api.postex.pk/') && c.token === 'test-postex-token-FICTIONAL')).toBe(true);
  });

  it('every call is logged, and the token is never written to the log', async () => {
    const agent = await loggedIn();
    await agent.post('/api/admin/integrations/postex/check');
    const logs = await IntegrationLog.find().lean();
    expect(logs.map((l) => l.action).sort()).toEqual(['get_addresses', 'get_cities']);
    expect(JSON.stringify(logs)).not.toContain('test-postex-token-FICTIONAL');
  });

  it('a wrong token gives a clear message', async () => {
    const agent = await loggedIn();
    answers['get-operational-city'] = { status: 401, body: { statusCode: '401', statusMessage: 'UNAUTHORIZED' } };
    const res = await agent.post('/api/admin/integrations/postex/check');
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/refused the token/);
  });

  it('PostEx down: tried once more, then a clear message; both attempts logged', async () => {
    const agent = await loggedIn();
    answers['get-operational-city'] = () => Promise.reject(new TypeError('fetch failed'));
    const res = await agent.post('/api/admin/integrations/postex/check');
    expect(res.status).toBe(504);
    expect(res.body.message).toMatch(/could not be reached/);
    expect(await IntegrationLog.countDocuments({ action: 'get_cities', status: 'failed' })).toBe(2);
  });
});

describe('Pickup address for bookings', () => {
  it('only your own PostEx address codes are accepted', async () => {
    const agent = await loggedIn();
    expect((await agent.patch('/api/admin/integrations/postex/settings').send({ pickupAddressCode: '999' })).status).toBe(400);
    const ok = await agent.patch('/api/admin/integrations/postex/settings').send({ pickupAddressCode: '050', returnAddressCode: '051' });
    expect(ok.body.postex).toEqual({ pickupAddressCode: '050', returnAddressCode: '051' });
    const cleared = await agent.patch('/api/admin/integrations/postex/settings').send({ returnAddressCode: null });
    expect(cleared.body.postex).toEqual({ pickupAddressCode: '050', returnAddressCode: null });
  });
});

describe('City matching', () => {
  it('spelling and capitals do not matter', () => {
    expect(cityKey('RAHIM YAR KHAN')).toBe(cityKey('Rahim-Yar Khan'));
  });

  it('sync marks which of our cities PostEx delivers to and lists the rest', async () => {
    const agent = await loggedIn();
    await cities();
    const res = await agent.post('/api/admin/integrations/postex/sync-cities');
    expect(res.body).toMatchObject({ postexDeliveryCities: 3, ourCities: 4, served: 2 });
    expect(res.body.notServed).toEqual(['Dera Ghazi Khan', 'Gilgit']);
    expect(res.body.notInOurList).toEqual(['D.G Khan']);

    const ryk = await City.findOne({ name: 'Rahim Yar Khan' }).lean();
    expect(ryk!.postex).toMatchObject({ name: 'RAHIM YAR KHAN', delivers: true, manual: false });
  });

  it('a hand match is kept by later syncs, and can be undone', async () => {
    const agent = await loggedIn();
    await cities();
    const dgk = await City.findOne({ name: 'Dera Ghazi Khan' });
    expect((await agent.patch(`/api/admin/integrations/postex/cities/${dgk!.id}`).send({ postexCityName: 'Nowhere' })).status).toBe(400);
    const matched = await agent.patch(`/api/admin/integrations/postex/cities/${dgk!.id}`).send({ postexCityName: 'd.g khan' });
    expect(matched.body.city.postex).toMatchObject({ name: 'D.G Khan', delivers: true, manual: true });

    const sync = await agent.post('/api/admin/integrations/postex/sync-cities');
    expect(sync.body.served).toBe(3);
    expect(sync.body.notInOurList).toEqual([]);

    await agent.patch(`/api/admin/integrations/postex/cities/${dgk!.id}`).send({ postexCityName: null });
    expect((await City.findById(dgk!._id).lean())!.postex).toMatchObject({ manual: false, delivers: false });
  });

  it('ready to book once a pickup address is chosen and cities are matched', async () => {
    const agent = await loggedIn();
    await cities();
    await agent.patch('/api/admin/integrations/postex/settings').send({ pickupAddressCode: '050' });
    await agent.post('/api/admin/integrations/postex/sync-cities');
    expect((await agent.get('/api/admin/integrations/postex')).body.postex.readyToBook).toBe(true);
  });

  it('PostEx routes need a login', async () => {
    expect((await request(app).post('/api/admin/integrations/postex/check')).status).toBe(401);
  });
});