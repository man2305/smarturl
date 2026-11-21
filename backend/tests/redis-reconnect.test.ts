import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { EventEmitter } from 'node:events';

type FakeRedisInstance = EventEmitter & {
  connect: () => Promise<void>;
  ping: () => Promise<string>;
  quit: () => Promise<string>;
};

// Shared mock state, hoisted so it survives vi.resetModules() (the mock
// factory re-runs on re-import, so state kept on the class would be lost).
const mockState = vi.hoisted(() => ({
  instances: [] as FakeRedisInstance[],
  lastOptions: null as Record<string, unknown> | null,
  failConnect: false,
}));

// Fake ioredis: an EventEmitter with connect/ping/quit, recording every
// instance and the options it was constructed with (so the retry strategy
// itself can be asserted on).
vi.mock('ioredis', async () => {
  const { EventEmitter } = await import('node:events');
  class FakeRedis extends EventEmitter {
    connect = async (): Promise<void> => {
      if (mockState.failConnect) throw new Error('connection refused');
    };
    ping = async (): Promise<string> => 'PONG';
    quit = async (): Promise<string> => 'OK';
    constructor(_url: string, options: Record<string, unknown>) {
      super();
      mockState.lastOptions = options;
      mockState.instances.push(this as unknown as FakeRedisInstance);
    }
  }
  return { default: FakeRedis };
});

describe('redis reconnect', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockState.instances.length = 0;
    mockState.lastOptions = null;
    mockState.failConnect = false;
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    vi.restoreAllMocks();
  });

  async function loadRedis() {
    return import('../src/config/redis');
  }

  it('uses a bounded backoff retry strategy that never gives up', async () => {
    const { connectRedis } = await loadRedis();
    await connectRedis();
    const retryStrategy = mockState.lastOptions?.retryStrategy as
      | ((times: number) => number | null)
      | undefined;
    expect(typeof retryStrategy).toBe('function');
    // Retries after a delay, and keeps retrying even after many attempts.
    expect(retryStrategy!(1)).toBeGreaterThan(0);
    expect(retryStrategy!(100)).toBeGreaterThan(0);
    expect(retryStrategy!(100)).toBeLessThanOrEqual(5000);
  });

  it('disables the cache on error and re-enables it on ready', async () => {
    const { connectRedis, isRedisEnabled } = await loadRedis();
    await connectRedis();
    expect(isRedisEnabled()).toBe(true);

    const client = mockState.instances[0];
    client.emit('error', new Error('boom'));
    expect(isRedisEnabled()).toBe(false);

    client.emit('ready');
    expect(isRedisEnabled()).toBe(true);
  });

  it('logs the connection error instead of swallowing it', async () => {
    mockState.failConnect = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { connectRedis, isRedisEnabled } = await loadRedis();
    await connectRedis();
    expect(isRedisEnabled()).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[redis] connection failed - running without cache:',
      'connection refused'
    );
  });

  it('stays disabled when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    const { connectRedis, isRedisEnabled } = await loadRedis();
    await connectRedis();
    expect(isRedisEnabled()).toBe(false);
    expect(mockState.instances).toHaveLength(0);
  });
});
