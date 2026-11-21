import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';

export function testApp(): Express {
  return createApp();
}

export type TestAgent = ReturnType<typeof request>;

export function testAgent(): TestAgent {
  return request(testApp());
}

export interface TestUser {
  name: string;
  email: string;
  password: string;
  userId: string;
  accessToken: string;
  refreshCookie: string;
}

let userCounter = 0;

/** Register a fresh user through the real API and return its credentials. */
export async function registerUser(
  api: TestAgent,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
): Promise<TestUser> {
  userCounter += 1;
  const name = overrides.name ?? 'Test User';
  const email = overrides.email ?? `user${userCounter}@example.com`;
  const password = overrides.password ?? 'password123';

  const res = await api
    .post('/api/auth/register')
    .send({ name, email, password })
    .expect(201);

  const refreshCookie = findRefreshCookie(res.headers['set-cookie']);
  if (!refreshCookie) throw new Error('register did not set a refresh cookie');

  return {
    name,
    email,
    password,
    userId: res.body.data.user.id as string,
    accessToken: res.body.data.accessToken as string,
    refreshCookie: refreshCookie.split(';')[0],
  };
}

/** Log in through the real API and return fresh tokens. */
export async function loginUser(
  api: TestAgent,
  email: string,
  password: string
): Promise<{ accessToken: string; refreshCookie: string }> {
  const res = await api.post('/api/auth/login').send({ email, password }).expect(200);
  const refreshCookie = findRefreshCookie(res.headers['set-cookie']);
  return {
    accessToken: res.body.data.accessToken as string,
    refreshCookie: refreshCookie.split(';')[0],
  };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Extract the `smarturl_refresh` cookie value (without attributes) if set. */
export function findRefreshCookie(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = cookies.find((c) => c.startsWith('smarturl_refresh='));
  return match ? match.split(';')[0] : '';
}
