import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';

// ── Test-only settings, set BEFORE any app code loads ──
// dotenv never overwrites a variable that is already set, so the real .env
// (database, email) cannot leak into the tests.
const url = new URL(inject('mongoUri'));
url.pathname = `/test_${randomUUID().slice(0, 8)}`; // each test file gets its own database
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = url.toString();
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else-0123456789';
process.env.CLIENT_URL = 'http://localhost:5173';
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) process.env[key] = ''; // no real emails

beforeAll(async () => {
  const { connectDB } = await import('../../src/config/db.js');
  await connectDB();

  // Safety net: stop if this is anything other than the throwaway test database
  const host = mongoose.connection.host;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Tests must run on the local test database, not ${host}`);
  }

  // Collections and unique indexes exist before any transaction runs
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
});

// Every test starts from an empty database and the default inventory rules
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  const { loadInventoryRules } = await import('../../src/modules/settings/inventoryRules.js');
  await loadInventoryRules();
});

afterAll(async () => {
  // Let fire-and-forget work (notification logs) finish before closing
  await new Promise((resolve) => setTimeout(resolve, 300));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});