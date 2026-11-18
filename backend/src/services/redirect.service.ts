import { urlRepository } from '../repositories/url.repository';
import { cacheService, toCachePayload } from './cache.service';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export type ResolveResult =
  | {
      status: 'ok';
      originalUrl: string;
      urlId: string;
      userId: string;
      maxClicks: number | null;
      /** True when this redirect already consumed one click of the budget. */
      clickClaimed: boolean;
    }
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
 * In-flight database lookups, keyed by slug. When many requests miss the
 * cache for the same slug at once (cache stampede), they share one lookup
 * instead of each hitting MongoDB. Entries are removed as soon as the
 * lookup settles, so a later request re-checks the (now populated) cache.
 * This is per-process only: across several API instances each instance
 * still performs one lookup per slug per stampede.
 */
const inflightLookups = new Map<string, Promise<ResolveResult>>();

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
 *
 * Click budgets are enforced by an atomic claim (see claimClick): a capped
 * link costs one MongoDB write per redirect, which is the price of a cap
 * that cannot overshoot. Uncapped links keep the cache-only fast path.
 */
export async function resolveShortCode(code: string): Promise<ResolveResult> {
  const cached = await cacheService.getShortCode(code);

  let resolved: ResolveResult;
  if (cached.status === 'negative') {
    throw ApiError.notFound('Short link not found');
  }

  if (cached.status === 'hit') {
    const data = cached.data;
    // Expiry outranks inactive: a budget-exhausted link is deactivated by
    // the claim, so a stale cached copy must still report 'expired' —
    // the link-unavailable page shows different copy per reason.
    if (isExpired(data)) {
      await urlRepository.deactivate(data.id);
      await cacheService.invalidateShortCode(code);
      return { status: 'expired' };
    }

    if (!data.isActive) return { status: 'inactive' };

    resolved = {
      status: 'ok',
      originalUrl: data.originalUrl,
      urlId: data.id,
      userId: data.userId,
      maxClicks: data.maxClicks,
      clickClaimed: false,
    };
  } else {
    const pending = inflightLookups.get(code);
    if (pending) {
      resolved = await pending;
    } else {
      const lookup = loadFromDatabase(code);
      inflightLookups.set(code, lookup);
      try {
        resolved = await lookup;
      } finally {
        inflightLookups.delete(code);
      }
    }
  }

  if (resolved.status !== 'ok' || resolved.maxClicks == null) return resolved;

  // Capped link: claim one click atomically. The claim — not the cached
  // click count — is authoritative, so concurrent redirects cannot
  // overshoot the budget.
  const claimed = await urlRepository.claimClick(resolved.urlId, resolved.maxClicks);
  if (claimed) {
    if (!claimed.isActive) {
      await cacheService.invalidateShortCode(code);
    }
    return { ...resolved, clickClaimed: true };
  }

  // Claim failed: re-read to tell budget-exhausted from inactive/deleted.
  // (A stale cap can also cause a failed claim when the cap was just
  // raised; retry once with the fresh cap before giving up.)
  const fresh = await urlRepository.findByShortCode(code);
  if (!fresh) throw ApiError.notFound('Short link not found');
  if (fresh.isActive && fresh.maxClicks != null && fresh.clicks < fresh.maxClicks) {
    const retry = await urlRepository.claimClick(fresh.id, fresh.maxClicks);
    if (retry) {
      if (!retry.isActive) {
        await cacheService.invalidateShortCode(code);
      }
      return { ...resolved, maxClicks: fresh.maxClicks, clickClaimed: true };
    }
  }
  if (fresh.maxClicks != null && fresh.clicks >= fresh.maxClicks) {
    await urlRepository.deactivate(fresh.id);
    await cacheService.invalidateShortCode(code);
    return { status: 'expired' };
  }
  if (!fresh.isActive) return { status: 'inactive' };
  return { status: 'expired' };
}

async function loadFromDatabase(code: string): Promise<ResolveResult> {
  const url = await urlRepository.findByShortCode(code);
  if (!url) {
    await cacheService.setNotFound(code);
    throw ApiError.notFound('Short link not found');
  }

  // Expiry outranks inactive (see the cache-hit path above): a request
  // that looks the link up after the budget ran out must see 'expired',
  // not 'inactive', or the reason flips depending on lookup timing.
  if (isExpired(url)) {
    await urlRepository.deactivate(url.id);
    await cacheService.invalidateShortCode(code);
    return { status: 'expired' };
  }

  if (!url.isActive) {
    await cacheService.setShortCode(code, toCachePayload(url), env.cacheTtl);
    return { status: 'inactive' };
  }

  await cacheService.setShortCode(code, toCachePayload(url), env.cacheTtl);
  return {
    status: 'ok',
    originalUrl: url.originalUrl,
    urlId: url.id,
    userId: url.userId.toString(),
    maxClicks: url.maxClicks,
    clickClaimed: false,
  };
}
