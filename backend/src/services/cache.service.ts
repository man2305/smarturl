import { redisClient } from '../config/redis';
import { NEGATIVE_CACHE_TTL, UNIQUE_VISITOR_TTL } from '../config/constants';
import type { IUrlDoc } from '../models/Url.model';

export interface CachedShortCode {
  id: string;
  userId: string;
  originalUrl: string;
  shortCode: string;
  isActive: boolean;
  isCustom: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
  clicks: number;
}

export type CacheLookup =
  | { status: 'hit'; data: CachedShortCode }
  | { status: 'negative' }
  | { status: 'miss' };

/** Build the compact payload cached under `short:<code>`. */
export function toCachePayload(url: IUrlDoc): CachedShortCode {
  return {
    id: url._id.toString(),
    userId: url.userId.toString(),
    originalUrl: url.originalUrl,
    shortCode: url.shortCode,
    isActive: url.isActive,
    isCustom: url.isCustom,
    expiresAt: url.expiresAt ? url.expiresAt.toISOString() : null,
    maxClicks: url.maxClicks ?? null,
    clicks: url.clicks,
  };
}

/**
 * Cache-aside wrapper around Redis.
 * - `set` on write (after DB create/update)
 * - `get` on read, falling through to the database on a miss
 * - `invalidate` (DEL) on every mutation so the cache never goes stale
 * Every operation is defensive: Redis outages degrade to db-only lookups.
 */
export const cacheService = {
  async getShortCode(code: string): Promise<CacheLookup> {
    const client = redisClient();
    if (!client) return { status: 'miss' };
    try {
      const raw = await client.get(`short:${code}`);
      if (!raw) return { status: 'miss' };
      const parsed = JSON.parse(raw);
      if (parsed && parsed._neg) return { status: 'negative' };
      return { status: 'hit', data: parsed as CachedShortCode };
    } catch {
      return { status: 'miss' };
    }
  },

  async setShortCode(code: string, data: CachedShortCode, ttl: number): Promise<void> {
    const client = redisClient();
    if (!client) return;
    try {
      await client.set(`short:${code}`, JSON.stringify(data), 'EX', ttl);
    } catch {
      /* noop */
    }
  },

  /** Cache a "this slug does not exist" marker to shield the DB from hot 404s. */
  async setNotFound(code: string, ttl = NEGATIVE_CACHE_TTL): Promise<void> {
    const client = redisClient();
    if (!client) return;
    try {
      await client.set(`short:${code}`, JSON.stringify({ _neg: true }), 'EX', ttl);
    } catch {
      /* noop */
    }
  },

  async invalidateShortCode(code: string): Promise<void> {
    const client = redisClient();
    if (!client) return;
    try {
      await client.del(`short:${code}`);
    } catch {
      /* noop */
    }
  },

  /**
   * Tracks unique visitors with a Redis set per URL.
   * Returns `true` the first time an IP visits a URL, `false` otherwise.
   */
  async isNewVisitor(urlId: string, ip: string): Promise<boolean> {
    const client = redisClient();
    if (!client) return false;
    try {
      const key = `uv:${urlId}`;
      const added = await client.sadd(key, ip);
      await client.expire(key, UNIQUE_VISITOR_TTL);
      return added === 1;
    } catch {
      return false;
    }
  },
};
