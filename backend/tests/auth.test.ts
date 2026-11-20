import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import {
  testAgent,
  registerUser,
  loginUser,
  authHeader,
  findRefreshCookie,
  type TestAgent,
} from './helpers/http';
import { env } from '../src/config/env';
import { hashToken } from '../src/services/token.service';
import { RefreshTokenModel } from '../src/models/RefreshToken.model';
import { UserModel } from '../src/models/User.model';

function rawToken(cookie: string): string {
  return cookie.split('=')[1] ?? '';
}

describe('auth', () => {
  let api: TestAgent;

  beforeAll(async () => {
    await startTestDb('auth');
    api = testAgent();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('registration', () => {
    it('registers a user, returns an access token and an httpOnly refresh cookie', async () => {
      const res = await api
        .post('/api/auth/register')
        .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('ada@example.com');
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.accessToken).toBeTruthy();

      const rawSetCookie = res.headers['set-cookie'];
      const setCookie = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie ?? ''];
      const cookie = setCookie.find((c) => c.startsWith('smarturl_refresh='));
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api/auth');
    });

    it('stores a bcrypt hash, never the plaintext password', async () => {
      await registerUser(api, { email: 'hash@example.com', password: 'password123' });
      const user = await UserModel.findOne({ email: 'hash@example.com' })
        .select('+password')
        .exec();
      expect(user).not.toBeNull();
      expect(user!.password).not.toBe('password123');
      expect(user!.password.startsWith('$2')).toBe(true);
      expect(await user!.comparePassword('password123')).toBe(true);
      expect(await user!.comparePassword('wrong-password')).toBe(false);
    });

    it('rejects a duplicate email with 409', async () => {
      await registerUser(api, { email: 'dup@example.com' });
      const res = await api
        .post('/api/auth/register')
        .send({ name: 'Other', email: 'dup@example.com', password: 'password123' })
        .expect(409);
      expect(res.body.message).toMatch(/already exists/);
    });

    it('concurrent duplicate registrations: exactly one succeeds', async () => {
      const attempts = await Promise.all(
        Array.from({ length: 5 }, () =>
          api
            .post('/api/auth/register')
            .send({ name: 'Racer', email: 'race@example.com', password: 'password123' })
        )
      );
      const created = attempts.filter((r) => r.status === 201);
      const conflicted = attempts.filter((r) => r.status === 409);
      expect(created).toHaveLength(1);
      expect(conflicted).toHaveLength(4);
      expect(await UserModel.countDocuments({ email: 'race@example.com' })).toBe(1);
    });

    it('rejects invalid input with 400', async () => {
      await api
        .post('/api/auth/register')
        .send({ name: 'A', email: 'not-an-email', password: 'short' })
        .expect(400);
      await api.post('/api/auth/register').send({}).expect(400);
    });
  });

  describe('login', () => {
    it('logs in with correct credentials', async () => {
      const user = await registerUser(api);
      const res = await api
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(findRefreshCookie(res.headers['set-cookie'])).toContain('smarturl_refresh=');
    });

    it('rejects a wrong password and an unknown email with 401', async () => {
      const user = await registerUser(api);
      await api
        .post('/api/auth/login')
        .send({ email: user.email, password: 'wrong-password' })
        .expect(401);
      await api
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('access tokens (/me)', () => {
    it('accepts a valid token, rejects missing and malformed ones', async () => {
      const user = await registerUser(api);
      await api.get('/api/auth/me').set(authHeader(user.accessToken)).expect(200);
      await api.get('/api/auth/me').expect(401);
      await api.get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);
      await api.get('/api/auth/me').set('Authorization', 'Basic abc').expect(401);
    });

    it('rejects an expired access token', async () => {
      const user = await registerUser(api);
      const expired = jwt.sign({ type: 'access' }, env.jwt.accessSecret, {
        subject: user.userId,
        issuer: env.jwt.issuer,
        audience: env.jwt.audience,
        expiresIn: '-1s',
      });
      await api.get('/api/auth/me').set(authHeader(expired)).expect(401);
    });

    it('rejects a refresh token used as an access token (type confusion)', async () => {
      const user = await registerUser(api);
      const refreshJwt = rawToken(user.refreshCookie);
      await api.get('/api/auth/me').set(authHeader(refreshJwt)).expect(401);
    });
  });

  describe('refresh rotation', () => {
    it('rotates: new pair issued, old refresh token is dead', async () => {
      const user = await registerUser(api);
      const res = await api
        .post('/api/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .expect(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.accessToken).not.toBe(user.accessToken);
      const newCookie = findRefreshCookie(res.headers['set-cookie']);
      expect(newCookie).toBeTruthy();
      expect(newCookie).not.toBe(user.refreshCookie);

      await api.post('/api/auth/refresh').set('Cookie', user.refreshCookie).expect(401);
      // The new token still works: the failed replay did not nuke the family.
      await api.post('/api/auth/refresh').set('Cookie', newCookie).expect(200);
    });

    it('concurrent refresh with the same token: exactly one succeeds', async () => {
      const user = await registerUser(api);
      const attempts = await Promise.all(
        Array.from({ length: 5 }, () =>
          api.post('/api/auth/refresh').set('Cookie', user.refreshCookie)
        )
      );
      const ok = attempts.filter((r) => r.status === 200);
      const denied = attempts.filter((r) => r.status === 401);
      expect(ok).toHaveLength(1);
      expect(denied).toHaveLength(4);

      // The losers were inside the grace window, so the family survives:
      // the winner's new token must still refresh.
      const winnerCookie = findRefreshCookie(ok[0].headers['set-cookie']);
      expect(winnerCookie).toBeTruthy();
      await api.post('/api/auth/refresh').set('Cookie', winnerCookie).expect(200);
    });

    it('reuse after the grace window revokes the whole token family', async () => {
      const user = await registerUser(api);
      const first = await api
        .post('/api/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .expect(200);
      const newCookie = findRefreshCookie(first.headers['set-cookie']);

      // Age the rotated token past the grace window, as a stolen-token
      // replay hours later would be.
      await RefreshTokenModel.updateOne(
        { token: hashToken(rawToken(user.refreshCookie)) },
        { $set: { rotatedAt: new Date(Date.now() - 60_000) } }
      ).exec();

      await api.post('/api/auth/refresh').set('Cookie', user.refreshCookie).expect(401);
      // Family revoked: even the legitimate new token is dead now.
      await api.post('/api/auth/refresh').set('Cookie', newCookie).expect(401);
    });

    it('rejects missing, malformed and wrong-type refresh tokens', async () => {
      const user = await registerUser(api);
      await api.post('/api/auth/refresh').expect(401);
      await api
        .post('/api/auth/refresh')
        .set('Cookie', 'smarturl_refresh=garbage')
        .expect(401);
      await api
        .post('/api/auth/refresh')
        .set('Cookie', `smarturl_refresh=${user.accessToken}`)
        .expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the session token but leaves other sessions alone', async () => {
      const user = await registerUser(api);
      const second = await loginUser(api, user.email, user.password);
      expect(second.refreshCookie).not.toBe(user.refreshCookie);

      await api.post('/api/auth/logout').set('Cookie', user.refreshCookie).expect(200);
      await api.post('/api/auth/refresh').set('Cookie', user.refreshCookie).expect(401);
      // The other login (a different token family) still refreshes.
      await api.post('/api/auth/refresh').set('Cookie', second.refreshCookie).expect(200);
    });

    it('logout without a cookie is a harmless no-op', async () => {
      await api.post('/api/auth/logout').expect(200);
    });
  });

  describe('CSRF origin check', () => {
    it('rejects cookie endpoints called from a foreign origin', async () => {
      await api
        .post('/api/auth/refresh')
        .set('Origin', 'https://evil.example.com')
        .expect(403);
      await api
        .post('/api/auth/login')
        .set('Origin', 'https://evil.example.com')
        .send({ email: 'a@example.com', password: 'password123' })
        .expect(403);
    });

    it('allows requests from the configured client origin (or with no origin)', async () => {
      await api
        .post('/api/auth/refresh')
        .set('Origin', env.clientUrl)
        .expect(401); // passes the origin check, fails on the missing token
      await api.post('/api/auth/refresh').expect(401);
    });
  });
});
