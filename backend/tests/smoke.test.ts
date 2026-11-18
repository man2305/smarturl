import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestDb, stopTestDb } from './helpers/db';
import { testAgent, registerUser, authHeader, type TestAgent } from './helpers/http';

describe('smoke: app boots against in-memory MongoDB', () => {
  let api: TestAgent;

  beforeAll(async () => {
    await startTestDb();
    api = testAgent();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('answers GET /api/health', async () => {
    const res = await api.get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns a generic 404 envelope for unknown routes', async () => {
    const res = await api.get('/api/no-such-route').expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Resource not found');
  });

  it('rejects unauthenticated access to /api/urls', async () => {
    await api.get('/api/urls').expect(401);
  });

  it('registers a user end to end (proves DB + auth wiring)', async () => {
    const user = await registerUser(api);
    expect(user.userId).toBeTruthy();
    expect(user.accessToken).toBeTruthy();
    expect(user.refreshCookie).toContain('smarturl_refresh=');

    const me = await api.get('/api/auth/me').set(authHeader(user.accessToken)).expect(200);
    expect(me.body.data.email).toBe(user.email);
  });
});
