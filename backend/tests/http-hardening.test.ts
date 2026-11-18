import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import {
  testAgent,
  registerUser,
  authHeader,
  type TestAgent,
  type TestUser,
} from './helpers/http';
import { env } from '../src/config/env';

describe('http hardening', () => {
  let api: TestAgent;
  let user: TestUser;

  beforeAll(async () => {
    await startTestDb('hardening');
    api = testAgent();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    user = await registerUser(api);
  });

  it('rejects malformed JSON with 400, not a crash', async () => {
    const res = await api
      .post('/api/urls')
      .set(authHeader(user.accessToken))
      .set('Content-Type', 'application/json')
      .send('{"originalUrl": broken')
      .expect(400);
    expect(res.body.message).toBe('Malformed JSON payload');
  });

  it('neutralises MongoDB operator injection in query params', async () => {
    // ?search[$gt]=... parses to an object; mongo-sanitize strips the
    // operator and the list handler must not crash on the remains.
    const res = await api
      .get('/api/urls?search[$gt]=x')
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.total).toBe(0);
  });

  it('neutralises MongoDB operators in request bodies', async () => {
    const res = await api
      .post('/api/urls')
      .set(authHeader(user.accessToken))
      .send({ originalUrl: 'https://example.com', isActive: { $gt: '' } })
      .expect(201);
    expect(res.body.data.isActive).toBe(true);
  });

  it('answers CORS preflight for the configured client origin', async () => {
    const res = await api
      .options('/api/urls')
      .set('Origin', env.clientUrl)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(env.clientUrl);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sets security headers via helmet', async () => {
    const res = await api.get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('returns field-level validation errors in the error envelope', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'A', email: 'bad', password: 'short' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.errors[0]).toHaveProperty('field');
  });

  it('does not leak stack traces or internals for unknown routes', async () => {
    const res = await api.get('/api/definitely-not-a-route').expect(404);
    expect(res.body).toEqual({ success: false, message: 'Resource not found' });
    expect(res.body.stack).toBeUndefined();
  });
});
