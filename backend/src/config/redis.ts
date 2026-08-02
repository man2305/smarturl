import Redis from 'ioredis';
import { env } from './env';

/**
 * Resilient Redis wrapper.
 * If Redis is unreachable the app degrades gracefully to database-only
 * lookups (cache-aside simply becomes a miss on every request) instead of
 * crashing the redirect hot path.
 */
let client: Redis | null = null;
let enabled = false;

export const isRedisEnabled = (): boolean => enabled;

export function redisClient(): Redis | null {
  return enabled ? client : null;
}

export async function connectRedis(): Promise<void> {
  if (!env.redisUrl) {
    console.warn('[redis] REDIS_URL not set - running without cache');
    return;
  }

  try {
    client = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      retryStrategy: () => null,
    });

    client.on('error', (err) => {
      enabled = false;
      if (env.nodeEnv !== 'production') {
        console.warn('[redis] connection lost - falling back to db-only:', err.message);
      }
    });

    await client.connect();
    await client.ping();
    enabled = true;
    console.log('[redis] connected');
  } catch {
    enabled = false;
    console.warn('[redis] connection failed - running without cache');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
    enabled = false;
  }
}
