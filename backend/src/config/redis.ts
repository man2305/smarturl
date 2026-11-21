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
let everConnected = false;

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
      // Bounded backoff, never give up: a transient outage (common on
      // free tiers / sleeping hosts) must not leave the app DB-only
      // until the next restart. Returning null here would do exactly that.
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });

    client.on('error', (err) => {
      enabled = false;
      console.warn('[redis] connection lost - falling back to db-only:', err.message);
    });

    // Recovery path: ioredis reconnects in the background (see
    // retryStrategy above); re-enable the cache when it comes back.
    // (everConnected keeps the first 'ready' at boot from logging as a
    // reconnect.)
    client.on('ready', () => {
      if (everConnected && !enabled) {
        enabled = true;
        console.log('[redis] reconnected');
      }
    });

    await client.connect();
    await client.ping();
    enabled = true;
    everConnected = true;
    console.log('[redis] connected');
  } catch (err) {
    enabled = false;
    console.warn(
      '[redis] connection failed - running without cache:',
      err instanceof Error ? err.message : err
    );
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
    enabled = false;
  }
}
