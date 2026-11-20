import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import {
  testAgent,
  registerUser,
  authHeader,
  type TestAgent,
  type TestUser,
} from './helpers/http';
import { UrlModel } from '../src/models/Url.model';

async function createUrl(
  api: TestAgent,
  user: TestUser,
  body: Record<string, unknown>,
  expectedStatus = 201
) {
  return api
    .post('/api/urls')
    .set(authHeader(user.accessToken))
    .send(body)
    .expect(expectedStatus);
}

describe('urls', () => {
  let api: TestAgent;
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    await startTestDb('urls');
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

  describe('create', () => {
    it('creates a short link with a random 7-char code', async () => {
      const res = await createUrl(api, user, { originalUrl: 'https://example.com/page' });
      expect(res.body.data.shortCode).toMatch(/^[0-9A-Za-z]{7}$/);
      expect(res.body.data.shortUrl).toBe(`http://localhost:5000/${res.body.data.shortCode}`);
      expect(res.body.data.isCustom).toBe(false);
      expect(res.body.data.clicks).toBe(0);
      expect(res.body.data.isActive).toBe(true);
    });

    it('creates a link with a custom alias', async () => {
      const res = await createUrl(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'my-link',
      });
      expect(res.body.data.shortCode).toBe('my-link');
      expect(res.body.data.isCustom).toBe(true);
    });

    it('rejects a duplicate alias with 409', async () => {
      await createUrl(api, user, { originalUrl: 'https://a.com', customAlias: 'taken' });
      const res = await createUrl(
        api,
        other,
        { originalUrl: 'https://b.com', customAlias: 'taken' },
        409
      );
      expect(res.body.message).toMatch(/already taken/);
    });

    it('concurrent duplicate aliases: exactly one succeeds', async () => {
      const attempts = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          api
            .post('/api/urls')
            .set(authHeader(i % 2 === 0 ? user.accessToken : other.accessToken))
            .send({ originalUrl: `https://example.com/${i}`, customAlias: 'race-alias' })
        )
      );
      const created = attempts.filter((r) => r.status === 201);
      const conflicted = attempts.filter((r) => r.status === 409);
      expect(created).toHaveLength(1);
      expect(conflicted).toHaveLength(4);
      expect(await UrlModel.countDocuments({ shortCode: 'race-alias' })).toBe(1);
    });

    it('rejects missing and invalid input with 400', async () => {
      await createUrl(api, user, {}, 400);
      await createUrl(api, user, { originalUrl: 'not-a-url' }, 400);
      await createUrl(api, user, { originalUrl: 'ftp://example.com' }, 400);
      await createUrl(api, user, { originalUrl: 'https://example.com', customAlias: 'ab' }, 400);
      await createUrl(
        api,
        user,
        { originalUrl: 'https://example.com', customAlias: 'has space' },
        400
      );
      await createUrl(
        api,
        user,
        { originalUrl: 'https://example.com', expiresAt: '2020-01-01T00:00:00Z' },
        400
      );
      await createUrl(api, user, { originalUrl: 'https://example.com', maxClicks: 0 }, 400);
      await createUrl(
        api,
        user,
        { originalUrl: 'https://example.com', maxClicks: 1_000_001 },
        400
      );
    });

    it('rejects reserved aliases', async () => {
      await createUrl(api, user, { originalUrl: 'https://example.com', customAlias: 'admin' }, 400);
      await createUrl(api, user, { originalUrl: 'https://example.com', customAlias: 'API' }, 400);
    });

    it('rejects unauthenticated creation', async () => {
      await api.post('/api/urls').send({ originalUrl: 'https://example.com' }).expect(401);
    });
  });

  describe('get', () => {
    it('returns the link to its owner and 404 to anyone else', async () => {
      const created = await createUrl(api, user, { originalUrl: 'https://example.com' });
      const id = created.body.data.id as string;
      await api.get(`/api/urls/${id}`).set(authHeader(user.accessToken)).expect(200);
      await api.get(`/api/urls/${id}`).set(authHeader(other.accessToken)).expect(404);
    });

    it('rejects malformed and unknown ids', async () => {
      await api.get('/api/urls/not-an-id').set(authHeader(user.accessToken)).expect(400);
      await api
        .get('/api/urls/000000000000000000000000')
        .set(authHeader(user.accessToken))
        .expect(404);
    });
  });

  describe('update', () => {
    it('updates the destination and clears expiry with null', async () => {
      const created = await createUrl(api, user, {
        originalUrl: 'https://old.example.com',
        expiresAt: '2030-01-01T00:00:00Z',
      });
      const id = created.body.data.id as string;
      const res = await api
        .patch(`/api/urls/${id}`)
        .set(authHeader(user.accessToken))
        .send({ originalUrl: 'https://new.example.com', expiresAt: null })
        .expect(200);
      expect(res.body.data.originalUrl).toBe('https://new.example.com');
      expect(res.body.data.expiresAt).toBeNull();
    });

    it('renames the alias and frees the old one', async () => {
      const created = await createUrl(api, user, {
        originalUrl: 'https://old-link.example.com',
        customAlias: 'old-name',
      });
      const id = created.body.data.id as string;
      const res = await api
        .patch(`/api/urls/${id}`)
        .set(authHeader(user.accessToken))
        .send({ customAlias: 'new-name' })
        .expect(200);
      expect(res.body.data.shortCode).toBe('new-name');

      // The old alias can be taken again, and it now serves the new link.
      await createUrl(api, other, {
        originalUrl: 'https://new-link.example.com',
        customAlias: 'old-name',
      });
      const oldAlias = await api.get('/old-name').expect(302);
      expect(oldAlias.headers.location).toBe('https://new-link.example.com');
      const newAlias = await api.get('/new-name').expect(302);
      expect(newAlias.headers.location).toBe('https://old-link.example.com');
    });

    it('rejects renaming to a taken alias with 409', async () => {
      await createUrl(api, user, { originalUrl: 'https://a.com', customAlias: 'taken-alias' });
      const created = await createUrl(api, user, {
        originalUrl: 'https://b.com',
        customAlias: 'mine-alias',
      });
      await api
        .patch(`/api/urls/${created.body.data.id}`)
        .set(authHeader(user.accessToken))
        .send({ customAlias: 'taken-alias' })
        .expect(409);
    });

    it('concurrent renames to the same alias: exactly one succeeds', async () => {
      const first = await createUrl(api, user, {
        originalUrl: 'https://a.com',
        customAlias: 'first-one',
      });
      const second = await createUrl(api, user, {
        originalUrl: 'https://b.com',
        customAlias: 'second-one',
      });
      const attempts = await Promise.all([
        api
          .patch(`/api/urls/${first.body.data.id}`)
          .set(authHeader(user.accessToken))
          .send({ customAlias: 'shared-new' }),
        api
          .patch(`/api/urls/${second.body.data.id}`)
          .set(authHeader(user.accessToken))
          .send({ customAlias: 'shared-new' }),
      ]);
      const ok = attempts.filter((r) => r.status === 200);
      const conflicted = attempts.filter((r) => r.status === 409);
      expect(ok).toHaveLength(1);
      expect(conflicted).toHaveLength(1);
      expect(await UrlModel.countDocuments({ shortCode: 'shared-new' })).toBe(1);
    });

    it('ignores null for nullable-absent fields instead of crashing', async () => {
      const created = await createUrl(api, user, { originalUrl: 'https://example.com' });
      const res = await api
        .patch(`/api/urls/${created.body.data.id}`)
        .set(authHeader(user.accessToken))
        .send({ customAlias: null, originalUrl: null, isActive: null })
        .expect(200);
      expect(res.body.data.originalUrl).toBe('https://example.com');
    });

    it('cannot update another user’s link', async () => {
      const created = await createUrl(api, user, { originalUrl: 'https://example.com' });
      await api
        .patch(`/api/urls/${created.body.data.id}`)
        .set(authHeader(other.accessToken))
        .send({ originalUrl: 'https://evil.example.com' })
        .expect(404);
    });
  });

  describe('delete', () => {
    it('deletes the link; the slug stops redirecting', async () => {
      const created = await createUrl(api, user, {
        originalUrl: 'https://example.com',
        customAlias: 'gone-link',
      });
      const id = created.body.data.id as string;
      await api.delete(`/api/urls/${id}`).set(authHeader(user.accessToken)).expect(200);
      await api.get(`/api/urls/${id}`).set(authHeader(user.accessToken)).expect(404);
      await api.get('/gone-link').expect(404);
      expect(await UrlModel.findById(id)).toBeNull();
    });

    it('cannot delete another user’s link', async () => {
      const created = await createUrl(api, user, { originalUrl: 'https://example.com' });
      await api
        .delete(`/api/urls/${created.body.data.id}`)
        .set(authHeader(other.accessToken))
        .expect(404);
      expect(await UrlModel.findById(created.body.data.id)).not.toBeNull();
    });
  });
});
