import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Env validation runs at module load, so each case re-imports the config
// module with a manipulated process.env. This file must not statically
// import any src module (the registry would cache the first load).
describe('env validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  async function loadEnv() {
    return import('../src/config/env');
  }

  it('rejects an unknown NODE_ENV', async () => {
    process.env.NODE_ENV = 'prod';
    await expect(loadEnv()).rejects.toThrow('NODE_ENV must be one of');
  });

  it('rejects a non-numeric rate-limit cap', async () => {
    process.env.RATE_LIMIT_MAX = 'abc';
    await expect(loadEnv()).rejects.toThrow('RATE_LIMIT_MAX must be an integer');
  });

  it('rejects a non-numeric port', async () => {
    process.env.PORT = 'abc';
    await expect(loadEnv()).rejects.toThrow('PORT must be an integer');
  });

  it('rejects an out-of-range port', async () => {
    process.env.PORT = '70000';
    await expect(loadEnv()).rejects.toThrow('PORT must be an integer between 1 and 65535');
  });

  it('rejects an invalid JWT expiry string', async () => {
    process.env.JWT_ACCESS_EXPIRES_IN = 'soon';
    await expect(loadEnv()).rejects.toThrow('JWT_ACCESS_EXPIRES_IN must be a duration');
  });

  it('strips trailing slashes from base and client URLs', async () => {
    process.env.BASE_URL = 'http://localhost:5000/';
    process.env.CLIENT_URL = 'http://localhost:5173//';
    const { env } = await loadEnv();
    expect(env.baseUrl).toBe('http://localhost:5000');
    expect(env.clientUrl).toBe('http://localhost:5173');
  });

  it('derives the refresh TTL from the JWT expiry string', async () => {
    process.env.JWT_REFRESH_EXPIRES_IN = '2d';
    const { env } = await loadEnv();
    expect(env.jwt.refreshTtlMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it('accepts a bare-seconds JWT expiry', async () => {
    process.env.JWT_REFRESH_EXPIRES_IN = '3600';
    const { env } = await loadEnv();
    expect(env.jwt.refreshTtlMs).toBe(3600 * 1000);
  });

  it('rejects short JWT secrets in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BASE_URL = 'https://api.example.com';
    process.env.CLIENT_URL = 'https://app.example.com';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/prod';
    process.env.JWT_ACCESS_SECRET = 'short';
    process.env.JWT_REFRESH_SECRET = 'also-short-but-different';
    await expect(loadEnv()).rejects.toThrow('at least 32 characters');
  });

  it('allows an empty REDIS_URL in production (cache is optional)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BASE_URL = 'https://api.example.com';
    process.env.CLIENT_URL = 'https://app.example.com';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/prod';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    delete process.env.REDIS_URL;
    const { env } = await loadEnv();
    expect(env.redisUrl).toBe('');
  });
});
