import { urlRepository } from '../repositories/url.repository';
import { cacheService, toCachePayload } from './cache.service';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export type ResolveResult =
  | { status: 'ok'; originalUrl: string; urlId: string; userId: string; maxClicks: number | null }
  | { status: 'expired' }
  | { status: 'inactive' };

interface ExpiryCandidate {
  expiresAt: string | Date | null;
  maxClicks: number | null;
  clicks: number;
}

function isExpired(p: ExpiryCandidate): boolean {
  if (p.expiresAt) {
    const expiry = typeof p.expiresAt === 'string' ? new Date(p.expiresAt).getTime() : p.expiresAt.getTime();
    if (expiry <= Date.now()) return true;
  }
  if (p.maxClicks != null && p.clicks >= p.maxClicks) return true;
  return false;
}

/**
 * The redirect hot path.
 *
 * Cache-aside flow:
 *  1. Try Redis -> hit: validate + redirect (no DB I/O, ~1ms).
 *  2. Miss   -> load from MongoDB, write-through to Redis, redirect.
 *  3. Miss (404) -> negative-cache the slug to absorb hot 404 traffic.
 *
 * Expired/inactive links are deactivated eagerly so a single DB sweep
 * (or the next hit) re-syncs state, and the cache is invalidated on change.
 */
export async function resolveShortCode(code: string): Promise<ResolveResult> {
  const cached = await cacheService.getShortCode(code);

  if (cached.status === 'negative') {
    throw ApiError.notFound('Short link not found');
  }

  if (cached.status === 'hit') {
    const data = cached.data;
    if (!data.isActive) return { status: 'inactive' };

    if (isExpired(data)) {
      await urlRepository.deactivate(data.id);
      await cacheService.invalidateShortCode(code);
      return { status: 'expired' };
    }

    return {
      status: 'ok',
      originalUrl: data.originalUrl,
      urlId: data.id,
      userId: data.userId,
      maxClicks: data.maxClicks,
    };
  }

  // Cache miss -> database lookup (cache-aside).
  const url = await urlRepository.findByShortCode(code);
  if (!url) {
    await cacheService.setNotFound(code);
    throw ApiError.notFound('Short link not found');
  }

  if (!url.isActive) {
    await cacheService.setShortCode(code, toCachePayload(url), env.cacheTtl);
    return { status: 'inactive' };
  }

  if (isExpired(url)) {
    await urlRepository.deactivate(url.id);
    await cacheService.invalidateShortCode(code);
    return { status: 'expired' };
  }

  await cacheService.setShortCode(code, toCachePayload(url), env.cacheTtl);
  return {
    status: 'ok',
    originalUrl: url.originalUrl,
    urlId: url.id,
    userId: url.userId.toString(),
    maxClicks: url.maxClicks,
  };
}
