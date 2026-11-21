import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import {
  testAgent,
  registerUser,
  authHeader,
  type TestAgent,
  type TestUser,
} from './helpers/http';
import { UrlModel } from '../src/models/Url.model';

async function seedLink(
  userId: string,
  over: Record<string, unknown>
): Promise<{ id: string; shortCode: string }> {
  const doc = await UrlModel.create({
    originalUrl: 'https://example.com',
    shortCode: `seed${Math.random().toString(36).slice(2, 8)}`,
    isCustom: false,
    userId: new Types.ObjectId(userId),
    clicks: 0,
    uniqueVisitors: 0,
    isActive: true,
    expiresAt: null,
    maxClicks: null,
    ...over,
  });
  return { id: doc.id, shortCode: doc.shortCode };
}

describe('search and pagination', () => {
  let api: TestAgent;
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    await startTestDb('search');
    api = testAgent();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    user = await registerUser(api);
    other = await registerUser(api);
  });

  async function list(
    u: TestUser,
    query: Record<string, string | number> = {},
    expectedStatus = 200
  ) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) params.set(k, String(v));
    const queryString = params.toString();
    return api
      .get(`/api/urls${queryString ? `?${queryString}` : ''}`)
      .set(authHeader(u.accessToken))
      .expect(expectedStatus);
  }

  describe('search', () => {
    it('matches originalUrl and shortCode case-insensitively', async () => {
      await seedLink(user.userId, {
        originalUrl: 'https://GitHub.com/man2305/smarturl',
        shortCode: 'gh-link',
      });
      await seedLink(user.userId, {
        originalUrl: 'https://other.example.com',
        shortCode: 'other01',
      });

      const byUrl = await list(user, { search: 'GITHUB' });
      expect(byUrl.body.meta.total).toBe(1);
      expect(byUrl.body.data[0].shortCode).toBe('gh-link');

      const byCode = await list(user, { search: 'GH-LINK' });
      expect(byCode.body.meta.total).toBe(1);
    });

    it('treats regex metacharacters literally', async () => {
      await seedLink(user.userId, {
        originalUrl: 'https://exampleXcom',
        shortCode: 'dotless',
      });
      await seedLink(user.userId, {
        originalUrl: 'https://example.com',
        shortCode: 'dotted1',
      });

      // '.' is a literal dot: example.com must not match exampleXcom.
      const dot = await list(user, { search: 'example.com' });
      expect(dot.body.meta.total).toBe(1);
      expect(dot.body.data[0].shortCode).toBe('dotted1');

      // '.*' as a regex would match everything; as a literal it matches nothing.
      const star = await list(user, { search: '.*' });
      expect(star.body.meta.total).toBe(0);

      // An unbalanced pattern must not error (unescaped it throws in Mongo).
      const paren = await list(user, { search: '(unbalanced' });
      expect(paren.body.meta.total).toBe(0);
    });

    it('never returns another user’s links', async () => {
      await seedLink(other.userId, {
        originalUrl: 'https://secret.example.com',
        shortCode: 'secret1',
      });
      const res = await list(user, { search: 'secret' });
      expect(res.body.meta.total).toBe(0);
    });

    it('tolerates an overlong search string', async () => {
      await seedLink(user.userId, { originalUrl: 'https://example.com', shortCode: 'plain01' });
      const res = await list(user, { search: 'x'.repeat(500) });
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('sorting and pagination', () => {
    it('pages stably through ties without duplicates or gaps', async () => {
      const clicks = [5, 0, 5, 0, 0];
      for (let i = 0; i < clicks.length; i++) {
        await seedLink(user.userId, {
          shortCode: `tie-${i}`,
          clicks: clicks[i],
          originalUrl: `https://example.com/${i}`,
        });
      }

      const seen: string[] = [];
      let prevClicks = Number.POSITIVE_INFINITY;
      for (let page = 1; page <= 3; page++) {
        const res = await list(user, { sortBy: 'clicks', sortOrder: 'desc', limit: 2, page });
        expect(res.body.meta.total).toBe(5);
        for (const item of res.body.data as { id: string; clicks: number }[]) {
          expect(item.clicks).toBeLessThanOrEqual(prevClicks);
          prevClicks = item.clicks;
          seen.push(item.id);
        }
      }
      expect(new Set(seen).size).toBe(5);

      // Same query twice returns the same order (deterministic sort).
      const first = await list(user, { sortBy: 'clicks', sortOrder: 'desc', limit: 5 });
      const second = await list(user, { sortBy: 'clicks', sortOrder: 'desc', limit: 5 });
      expect(second.body.data.map((d: { id: string }) => d.id)).toEqual(
        first.body.data.map((d: { id: string }) => d.id)
      );
    });

    it('reports correct meta and clamps invalid parameters', async () => {
      for (let i = 0; i < 25; i++) {
        await seedLink(user.userId, { shortCode: `bulk-${i}` });
      }

      const page2 = await list(user, { page: 2, limit: 10 });
      expect(page2.body.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
      expect(page2.body.data).toHaveLength(10);

      const page3 = await list(user, { page: 3, limit: 10 });
      expect(page3.body.data).toHaveLength(5);

      const beyond = await list(user, { page: 99, limit: 10 });
      expect(beyond.body.data).toHaveLength(0);
      expect(beyond.body.meta.totalPages).toBe(3);

      const clamped = await list(user, { page: 1, limit: 100 });
      expect(clamped.body.meta.limit).toBe(50);
      expect(clamped.body.data).toHaveLength(25);

      const invalid = await list(user, { page: 'abc', limit: 'xyz' });
      expect(invalid.body.meta.page).toBe(1);
      expect(invalid.body.meta.limit).toBe(10);

      const negative = await list(user, { page: -3, limit: -5 });
      expect(negative.body.meta.page).toBe(1);
      expect(negative.body.meta.limit).toBe(1);
    });

    it('falls back to createdAt for unknown sort fields', async () => {
      await seedLink(user.userId, { shortCode: 'sort-a' });
      await seedLink(user.userId, { shortCode: 'sort-b' });
      const res = await list(user, { sortBy: 'password', sortOrder: 'up' });
      expect(res.body.meta.total).toBe(2);
      // Default is createdAt desc: newest first.
      expect(res.body.data[0].shortCode).toBe('sort-b');
    });

    it('filters by status', async () => {
      await seedLink(user.userId, { shortCode: 'act-001', isActive: true });
      await seedLink(user.userId, { shortCode: 'inact01', isActive: false });

      expect((await list(user, { status: 'active' })).body.meta.total).toBe(1);
      expect((await list(user, { status: 'expired' })).body.meta.total).toBe(1);
      expect((await list(user, { status: 'all' })).body.meta.total).toBe(2);
      expect((await list(user, { status: 'bogus' })).body.meta.total).toBe(2);
    });

    it('treats a past-expiry link as expired even before the sweeper runs', async () => {
      await seedLink(user.userId, { shortCode: 'act-002', isActive: true });
      await seedLink(user.userId, {
        shortCode: 'past001',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
      });

      // The badge shows "Expired" for past-date links, so the filter must
      // agree — otherwise the link appears under "Active" with an
      // "Expired" badge.
      const active = await list(user, { status: 'active' });
      expect(active.body.meta.total).toBe(1);
      expect(active.body.data[0].shortCode).toBe('act-002');
      const expired = await list(user, { status: 'expired' });
      expect(expired.body.meta.total).toBe(1);
      expect(expired.body.data[0].shortCode).toBe('past001');
    });

    it('returns an empty page with zero totals when the user has no links', async () => {
      const res = await list(user, {});
      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 1 });
    });
  });
});
