import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';

// A few checks through the real HTTP routes (like your curl tests)
describe('HTTP routes', () => {
  it('health check reports the database as connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  it('checkout offers cash on delivery', async () => {
    const res = await request(app).get('/api/checkout/payment-methods');
    expect(res.status).toBe(200);
    expect(res.body.methods.map((m: { method: string }) => m.method)).toEqual(['cod']);
  });

  it('admin routes need a login', async () => {
    for (const path of ['/api/admin/orders', '/api/admin/orders/couriers', '/api/admin/reports/sales', '/api/admin/settings']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
  });

  it('checkout input is validated', async () => {
    const res = await request(app).post('/api/checkout').send({ name: 'X', phone: '123' });
    expect(res.status).toBe(400);
  });
});