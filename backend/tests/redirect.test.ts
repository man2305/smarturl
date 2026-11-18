import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import { mockRedis } from './helpers/redis-mock';
import { waitFor } from './helpers/wait';

// Redirect tests run against the in-memory Redis mock so cache behaviour
// (hits, misses, negative entries, invalidation) is exercised for real.
vi.mock('../src/config/redis', async () => {
  const { mockRedisModule } = await import('./helpers/redis-mock');
  return mockRedisModule();
});

import {
  testAgent,
  registerUser,
  authHeader,
  type TestAgent,
  type TestUser,
} from './helpers/http';
import { UrlModel } from '../src/models/Url.model';
import { AnalyticsModel } from '../src/models/Analytics.model';
import { urlRepository } from '../src/repositories/url.repository';
import { env } from '../src/config/env';

async function createLink(
  api: TestAgent,
  user: TestUser,
  body: Record<string, unknown>
): Promise<{ id: string; shortCode: string }> {
  const res = await api
    .post('/api/urls')
    .set(authHeader(user.accessToken))
    .send(body)
    .expect(201);
  return { id: res.body.data.id as string, shortCode: res.body.data.shortCode as string };
}

describe('redirect', () => {
  let api: TestAgent;
  let user: TestUser;

  beforeAll(async () => {
    await startTestDb('redirect');
    api = testAgent();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await mockRedis.flushall();
    user = await registerUser(api);
  });

  it('redirects a valid slug with 302, no-store, and records the click', async () => {
    const link = await createLink(api, user, {
      originalUrl: 'https://destination.example.com/page',
      customAlias: 'dest001',
    });
    const res = await api.get('/dest001').expect(302);
    expect(res.headers.location).toBe('https://destination.example.com/page');
    expect(res.headers['cache-control']).toBe('no-store');

    await waitFor(async () => {
      const doc = await UrlModel.findById(link.id).exec();
      return doc?.clicks === 1;
    }, 3000, 'click counter to reach 1');
    expect(await AnalyticsModel.countDocuments({ urlId: link.id })).toBe(1);
  });

  it('serves the second request from cache (one DB lookup for two hits)', async () => {
    await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'cache01',
    });
    await mockRedis.flushall(); // force a genuine cache miss on the first hit
    const spy = vi.spyOn(urlRepository, 'findByShortCode');
    try {
      await api.get('/cache01').expect(302);
      const cached = await mockRedis.get('short:cache01');
      expect(cached).toContain('https://example.com');

      await api.get('/cache01').expect(302);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('negative-caches unknown slugs (one DB lookup for repeated 404s)', async () => {
    const spy = vi.spyOn(urlRepository, 'findByShortCode');
    try {
      await api.get('/no-such-slug').expect(404);
      expect(await mockRedis.get('short:no-such-slug')).toBe('{"_neg":true}');
      await api.get('/no-such-slug').expect(404);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects malformed slugs without touching the database', async () => {
    const spy = vi.spyOn(urlRepository, 'findByShortCode');
    try {
      // Too short, too long, and illegal characters can never be real
      // slugs (random codes and aliases both match ALIAS_REGEX).
      await api.get('/ab').expect(404);
      await api.get('/a-very-long-slug-that-exceeds-thirty-two-chars').expect(404);
      await api.get('/favicon.ico').expect(404);
      expect(spy).not.toHaveBeenCalled();
      expect(await mockRedis.get('short:favicon.ico')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('coalesces a cache stampede into a single DB lookup', async () => {
    await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'hotlink',
    });
    await mockRedis.flushall();
    const spy = vi.spyOn(urlRepository, 'findByShortCode');
    try {
      const responses = await Promise.all(
        Array.from({ length: 20 }, () => api.get('/hotlink'))
      );
      expect(responses.every((r) => r.status === 302)).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('sends expired links to the unavailable page and deactivates them', async () => {
    const link = await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'oldlink',
    });
    await UrlModel.updateOne(
      { _id: link.id },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    ).exec();
    await mockRedis.flushall();

    const res = await api.get('/oldlink').expect(302);
    expect(res.headers.location).toBe(`${env.clientUrl}/link-unavailable?reason=expired`);
    expect((await UrlModel.findById(link.id).exec())?.isActive).toBe(false);
  });

  it('sends inactive links to the unavailable page', async () => {
    const link = await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'offlink',
    });
    await UrlModel.updateOne({ _id: link.id }, { $set: { isActive: false } }).exec();
    await mockRedis.flushall();

    const res = await api.get('/offlink').expect(302);
    expect(res.headers.location).toBe(`${env.clientUrl}/link-unavailable?reason=inactive`);
  });

  it('treats a budget-exhausted link as expired', async () => {
    const link = await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'spent01',
      maxClicks: 2,
    });
    await UrlModel.updateOne({ _id: link.id }, { $set: { clicks: 2 } }).exec();
    await mockRedis.flushall();

    const res = await api.get('/spent01').expect(302);
    expect(res.headers.location).toContain('reason=expired');
  });

  it('applies the redirect rate limiter (limit headers present)', async () => {
    await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'limit01',
    });
    const res = await api.get('/limit01').expect(302);
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  it('serves the new destination after an update (cache invalidated)', async () => {
    const link = await createLink(api, user, {
      originalUrl: 'https://before.example.com',
      customAlias: 'change1',
    });
    await api.get('/change1').expect(302);
    await api
      .patch(`/api/urls/${link.id}`)
      .set(authHeader(user.accessToken))
      .send({ originalUrl: 'https://after.example.com' })
      .expect(200);

    const res = await api.get('/change1').expect(302);
    expect(res.headers.location).toBe('https://after.example.com');
  });

  it('stops redirecting after a delete (cache invalidated)', async () => {
    const link = await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'delme01',
    });
    await api.get('/delme01').expect(302);
    await api.delete(`/api/urls/${link.id}`).set(authHeader(user.accessToken)).expect(200);
    await api.get('/delme01').expect(404);
  });

  it('falls back to the database when Redis fails', async () => {
    await createLink(api, user, {
      originalUrl: 'https://example.com',
      customAlias: 'dbfall1',
    });
    await mockRedis.flushall();
    const getSpy = vi.spyOn(mockRedis, 'get').mockRejectedValueOnce(new Error('redis down'));
    try {
      const res = await api.get('/dbfall1').expect(302);
      expect(res.headers.location).toBe('https://example.com');
    } finally {
      getSpy.mockRestore();
    }
  });
});
