import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cloudinary is replaced by a fake that remembers uploads and deletes. No real upload happens.
const uploaded: string[] = [];
const deleted: string[] = [];
let storageOn = true;
let counter = 0;
vi.mock('../src/providers/storage/cloudinary.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/providers/storage/cloudinary.js')>();
  const AppError = (await import('../src/utils/AppError.js')).default;
  return {
    ...real,
    isImageStorageConfigured: () => storageOn,
    uploadImage: async (_file: Buffer, options: { folder: string }) => {
      if (!storageOn) throw new AppError('Photo uploads are not set up yet. Add the Cloudinary keys to the server .env file.', 503);
      counter += 1;
      const publicId = `test/${options.folder}/photo${counter}`;
      uploaded.push(publicId);
      return { publicId, url: `https://img.test/${publicId}-large`, thumbUrl: `https://img.test/${publicId}-small`, width: 1600, height: 1600, bytes: 1000, format: 'jpg' };
    },
    deleteImage: async (publicId: string) => {
      deleted.push(publicId);
      return true;
    },
  };
});

const { default: app } = await import('../src/app.js');
const { default: Admin } = await import('../src/models/Admin.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { createStore, createVariant, receive } = await import('./helpers/fixtures.js');
const { detectImageKind } = await import('../src/modules/media/imageFile.js');

// Tiny fake files: only the first bytes matter for the type check (FICTIONAL test data)
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(100)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function loggedIn() {
  await Admin.create({ name: 'Test Admin (FICTIONAL)', email: 'photos.admin@example.com', passwordHash: await bcrypt.hash('test-password-123', 4) });
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ email: 'photos.admin@example.com', password: 'test-password-123' }).expect(200);
  return agent;
}

// alt: null = send no alt text at all
const upload = (agent: ReturnType<typeof request.agent>, productId: string, file: Buffer, name = 'photo.jpg', alt: string | null = 'TEST almonds in a jar') => {
  const req = agent.post(`/api/admin/products/${productId}/images`).attach('image', file, name);
  return alt === null ? req : req.field('alt', alt);
};

beforeEach(() => {
  uploaded.length = 0;
  deleted.length = 0;
  storageOn = true;
});

describe('Photo file checks', () => {
  it('recognises JPG, PNG and WebP from the file bytes; refuses SVG and text', () => {
    expect(detectImageKind(JPEG)).toBe('jpeg');
    expect(detectImageKind(PNG)).toBe('png');
    expect(detectImageKind(WEBP)).toBe('webp');
    expect(detectImageKind(SVG)).toBeNull();
    expect(detectImageKind(Buffer.from('hello'))).toBeNull();
  });
});

describe('Product photos (admin)', () => {
  it('upload: saved on the product with a large and a small copy; audited', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();

    const res = await upload(agent, product.id, JPEG);
    expect(res.status).toBe(201);
    expect(res.body.images).toEqual([expect.objectContaining({ alt: 'TEST almonds in a jar', url: expect.stringContaining('-large'), thumbUrl: expect.stringContaining('-small') })]);
    expect(uploaded[0]).toContain(`products/${product.id}`);
    expect(await AuditLog.countDocuments({ action: 'product.image_add' })).toBe(1);
  });

  it('refuses a file that is not a real photo, even if it is named .jpg', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();
    const res = await upload(agent, product.id, SVG, 'logo.jpg');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please upload a JPG, PNG or WebP photo');
    expect(uploaded).toHaveLength(0);
  });

  it('alt text is required; a missing file is explained', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();
    const noAlt = await upload(agent, product.id, PNG, 'p.png', null);
    expect(noAlt.status).toBe(400);
    expect(uploaded).toHaveLength(0);
    const noFile = await agent.post(`/api/admin/products/${product.id}/images`).field('alt', 'TEST photo');
    expect(noFile.body.message).toMatch(/Choose a photo/);
  });

  it('a photo over 5 MB is refused', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(agent, product.id, big);
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too big/);
  });

  it('at most 8 photos per product', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();
    for (let i = 0; i < 8; i += 1) expect((await upload(agent, product.id, JPEG)).status).toBe(201);
    const ninth = await upload(agent, product.id, JPEG);
    expect(ninth.status).toBe(409);
    expect(ninth.body.message).toMatch(/at most 8 photos/);
  });

  it('reorder (first = main photo), change alt text, remove (also deleted from storage)', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();
    await upload(agent, product.id, JPEG, 'a.jpg', 'TEST first');
    const second = await upload(agent, product.id, PNG, 'b.png', 'TEST second');
    const [a, b] = second.body.images.map((i: { publicId: string }) => i.publicId);

    const reordered = await agent.put(`/api/admin/products/${product.id}/images/order`).send({ publicIds: [b, a] });
    expect(reordered.body.images.map((i: { alt: string }) => i.alt)).toEqual(['TEST second', 'TEST first']);

    const bad = await agent.put(`/api/admin/products/${product.id}/images/order`).send({ publicIds: [b] });
    expect(bad.status).toBe(400);

    const renamed = await agent.patch(`/api/admin/products/${product.id}/images`).send({ publicId: a, alt: 'TEST almonds close up' });
    expect(renamed.body.images[1].alt).toBe('TEST almonds close up');

    const removed = await agent.delete(`/api/admin/products/${product.id}/images`).send({ publicId: b });
    expect(removed.body.images).toHaveLength(1);
    expect(deleted).toEqual([b]);
  });

  it('without Cloudinary keys: a clear message, nothing saved', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();
    storageOn = false;
    const res = await upload(agent, product.id, JPEG);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not set up yet/);
  });

  it('photo routes need a login', async () => {
    const { product } = await createStore();
    expect((await request(app).post(`/api/admin/products/${product.id}/images`).attach('image', JPEG, 'a.jpg')).status).toBe(401);
  });

  it('the website shows the small copy on cards and both copies on the product page', async () => {
    const agent = await loggedIn();
    const { product } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 5, 200);
    await upload(agent, product.id, JPEG);

    const list = await request(app).get('/api/products');
    expect(list.body.items[0].image.url).toContain('-small');
    const page = await request(app).get(`/api/products/${product.slug}`);
    expect(page.body.product?.images ?? page.body.images).toBeDefined();
    expect(JSON.stringify(page.body)).toContain('-large');
  });
});

describe('Store logo', () => {
  it('upload, replace (old one deleted), remove; shown on the public store info', async () => {
    const agent = await loggedIn();
    const first = await agent.post('/api/admin/settings/logo').attach('image', PNG, 'logo.png');
    expect(first.status).toBe(201);
    const second = await agent.post('/api/admin/settings/logo').attach('image', PNG, 'logo2.png');
    expect(deleted).toEqual([first.body.logo.publicId]);

    const store = await request(app).get('/api/store');
    expect(store.status).toBe(200);
    expect(store.body.store.logo.url).toBe(second.body.logo.url);
    expect(store.body.store).not.toHaveProperty('templates');

    await agent.delete('/api/admin/settings/logo').expect(200);
    expect((await request(app).get('/api/store')).body.store.logo).toBeNull();
  });

  it('a logo over 2 MB is refused', async () => {
    const agent = await loggedIn();
    const res = await agent.post('/api/admin/settings/logo').attach('image', Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), 'logo.png');
    expect(res.status).toBe(413);
  });
});