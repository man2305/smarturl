import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Types } from 'mongoose';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import { mockRedis } from './helpers/redis-mock';
import { waitFor } from './helpers/wait';

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
import { analyticsRepository } from '../src/repositories/analytics.repository';
import { urlRepository } from '../src/repositories/url.repository';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0';

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

async function clickCount(urlId: string): Promise<number> {
  return (await UrlModel.findById(urlId).exec())?.clicks ?? -1;
}

describe('analytics', () => {
  let api: TestAgent;
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    await startTestDb('analytics');
    api = testAgent();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await mockRedis.flushall();
    user = await registerUser(api);
    other = await registerUser(api);
  });

  describe('click budgets', () => {
    it('a maxClicks=3 link serves exactly 3 redirects under 10 concurrent hits', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'cap3x01',
        maxClicks: 3,
      });
      await mockRedis.flushall();

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => api.get('/cap3x01'))
      );
      const served = responses.filter((r) => r.headers.location === 'https://example.com');
      const expired = responses.filter((r) =>
        (r.headers.location as string | undefined)?.includes('reason=expired')
      );
      expect(responses.every((r) => r.status === 302)).toBe(true);
      expect(served).toHaveLength(3);
      expect(expired).toHaveLength(7);

      // Claims are awaited in the redirect path, so the count is exact
      // immediately — no polling needed.
      expect(await clickCount(link.id)).toBe(3);
      const doc = await UrlModel.findById(link.id).exec();
      expect(doc?.isActive).toBe(false);

      await waitFor(
        async () => (await AnalyticsModel.countDocuments({ urlId: link.id })) === 3,
        3000,
        '3 analytics events'
      );
    });

    it('a maxClicks=1 link serves exactly 1 of 2 concurrent hits', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'cap1x01',
        maxClicks: 1,
      });
      await mockRedis.flushall();

      const responses = await Promise.all([api.get('/cap1x01'), api.get('/cap1x01')]);
      const served = responses.filter((r) => r.headers.location === 'https://example.com');
      expect(served).toHaveLength(1);
      expect(await clickCount(link.id)).toBe(1);
    });

    it('uncapped links count every concurrent click', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'nocap01',
      });
      const responses = await Promise.all(
        Array.from({ length: 20 }, () => api.get('/nocap01'))
      );
      expect(responses.every((r) => r.status === 302)).toBe(true);
      await waitFor(async () => (await clickCount(link.id)) === 20, 5000, '20 clicks');
      await waitFor(
        async () => (await AnalyticsModel.countDocuments({ urlId: link.id })) === 20,
        5000,
        '20 analytics events'
      );
    });
  });

  describe('unique visitors', () => {
    it('counts one IP once, distinct IPs separately', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'uvtest1',
      });
      for (let i = 0; i < 5; i++) {
        await api.get('/uvtest1').expect(302);
      }
      await api.get('/uvtest1').set('X-Forwarded-For', '203.0.113.5').expect(302);
      await api.get('/uvtest1').set('X-Forwarded-For', '198.51.100.9').expect(302);

      await waitFor(async () => {
        const doc = await UrlModel.findById(link.id).exec();
        return doc?.uniqueVisitors === 3;
      }, 5000, 'uniqueVisitors to reach 3');
      await waitFor(async () => (await clickCount(link.id)) === 7, 5000, '7 clicks');
    });

    it('falls back to the database when the Redis SADD fails', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'uvfall1',
      });
      const saddSpy = vi.spyOn(mockRedis, 'sadd').mockRejectedValueOnce(new Error('redis down'));
      try {
        await api.get('/uvfall1').expect(302);
        await waitFor(async () => {
          const doc = await UrlModel.findById(link.id).exec();
          return doc?.uniqueVisitors === 1;
        }, 5000, 'uniqueVisitors to reach 1 via DB fallback');
      } finally {
        saddSpy.mockRestore();
      }
    });
  });

  describe('partial failures', () => {
    it('a failed event insert skips the counter (no phantom click)', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'fail-ev',
      });
      const createSpy = vi
        .spyOn(analyticsRepository, 'create')
        .mockRejectedValueOnce(new Error('db down'));
      try {
        await api.get('/fail-ev').expect(302);
        // Give the fire-and-forget recording time to run and fail.
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(await clickCount(link.id)).toBe(0);
        expect(await AnalyticsModel.countDocuments({ urlId: link.id })).toBe(0);
      } finally {
        createSpy.mockRestore();
      }
    });

    it('a failed counter increment still keeps the event row', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'fail-ct',
      });
      const incSpy = vi
        .spyOn(urlRepository, 'incrementCounters')
        .mockRejectedValueOnce(new Error('db down'));
      try {
        await api.get('/fail-ct').expect(302);
        await waitFor(
          async () => (await AnalyticsModel.countDocuments({ urlId: link.id })) === 1,
          3000,
          '1 analytics event'
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(await clickCount(link.id)).toBe(0);
      } finally {
        incSpy.mockRestore();
      }
    });
  });

  describe('stats API', () => {
    it('reports totals, daily series and breakdowns for a link', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'stats01',
      });
      for (let i = 0; i < 3; i++) {
        await api
          .get('/stats01')
          .set('User-Agent', CHROME_UA)
          .set('Referer', 'https://google.com')
          .expect(302);
      }
      await api
        .get('/stats01')
        .set('User-Agent', FIREFOX_UA)
        .set('X-Forwarded-For', '8.8.8.8')
        .expect(302);

      await waitFor(
        async () => (await AnalyticsModel.countDocuments({ urlId: link.id })) === 4,
        5000,
        '4 analytics events'
      );

      const res = await api
        .get(`/api/analytics/urls/${link.id}`)
        .set(authHeader(user.accessToken))
        .expect(200);
      const data = res.body.data;
      expect(data.totalClicks).toBe(4);
      expect(data.url.clicks).toBe(4);

      const today = new Date().toISOString().slice(0, 10);
      expect(data.daily).toContainEqual({ date: today, clicks: 4 });

      const byName = (rows: { name: string; value: number }[]) =>
        new Map(rows.map((r) => [r.name, r.value]));
      expect(byName(data.browsers).get('Chrome')).toBe(3);
      expect(byName(data.browsers).get('Firefox')).toBe(1);
      expect(byName(data.referrers).get('https://google.com')).toBe(3);
      expect(byName(data.referrers).get('Direct')).toBe(1);

      const us = (data.countries as { name: string; value: number; countryCode?: string }[]).find(
        (c) => c.countryCode === 'US'
      );
      expect(us).toBeDefined();
      expect(us!.name).toBe('United States');
      expect(us!.value).toBe(1);
    });

    it('breakdowns respect the days window; totalClicks stays lifetime', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'window1',
      });
      await api.get('/window1').set('User-Agent', CHROME_UA).expect(302);
      await waitFor(
        async () => (await AnalyticsModel.countDocuments({ urlId: link.id })) === 1,
        3000,
        '1 analytics event'
      );
      await AnalyticsModel.create({
        urlId: new Types.ObjectId(link.id),
        userId: new Types.ObjectId(user.userId),
        ip: '203.0.113.9',
        userAgent: '',
        referrer: null,
        browser: 'OldBrowser',
        browserVersion: '',
        os: 'Unknown',
        device: 'desktop',
        deviceName: '',
        country: 'Unknown',
        countryCode: '',
        clickedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      });

      const week = await api
        .get(`/api/analytics/urls/${link.id}?days=7`)
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(
        (week.body.data.browsers as { name: string }[]).some((b) => b.name === 'OldBrowser')
      ).toBe(false);
      expect(week.body.data.totalClicks).toBe(2);

      const year = await api
        .get(`/api/analytics/urls/${link.id}?days=365`)
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(
        (year.body.data.browsers as { name: string }[]).some((b) => b.name === 'OldBrowser')
      ).toBe(true);
    });

    it('overview aggregates only the caller’s links', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'ovrview',
      });
      await createLink(api, other, {
        originalUrl: 'https://example.com',
        customAlias: 'ovr-oth',
      });
      await api.get('/ovrview').expect(302);
      await waitFor(async () => (await clickCount(link.id)) === 1, 3000, '1 click');

      const res = await api
        .get('/api/analytics/overview')
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(res.body.data.overview.totalLinks).toBe(1);
      expect(res.body.data.overview.totalClicks).toBe(1);
      expect(res.body.data.overview.activeLinks).toBe(1);
      expect(res.body.data.topLinks).toHaveLength(1);
      expect(res.body.data.recentActivity).toHaveLength(1);
      expect(res.body.data.recentActivity[0].shortCode).toBe('ovrview');
    });

    it('rejects other users’ stats and invalid params', async () => {
      const link = await createLink(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'priv001',
      });
      await api
        .get(`/api/analytics/urls/${link.id}`)
        .set(authHeader(other.accessToken))
        .expect(404);
      await api
        .get('/api/analytics/urls/not-an-id')
        .set(authHeader(user.accessToken))
        .expect(400);
      await api
        .get(`/api/analytics/urls/${link.id}?days=0`)
        .set(authHeader(user.accessToken))
        .expect(400);
      await api
        .get(`/api/analytics/urls/${link.id}?days=400`)
        .set(authHeader(user.accessToken))
        .expect(400);
    });
  });
});
