import { Types } from 'mongoose';
import { urlRepository, type ListUrlsParams } from '../repositories/url.repository';
import { analyticsRepository } from '../repositories/analytics.repository';
import { ApiError } from '../utils/ApiError';
import { generateShortCode } from '../utils/base62';
import { serializeUrl, type SerializedUrl } from '../utils/serializers';
import { cacheService, toCachePayload } from './cache.service';
import { env } from '../config/env';
import { SHORT_CODE_MAX_ATTEMPTS } from '../config/constants';

export interface ShortenInput {
  userId: string;
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string;
  maxClicks?: number;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'all' | 'active' | 'expired';
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const urlService = {
  async shorten(input: ShortenInput): Promise<SerializedUrl> {
    const isCustom = Boolean(input.customAlias);
    const alias = isCustom ? (input.customAlias as string).trim() : null;

    // Custom aliases are tried once: a collision is the user's choice
    // conflicting with an existing slug, so it is a 409. Random codes are
    // retried with a fresh code on collision — the unique index, not a
    // pre-check, is the authority, so a late collision must not surface
    // as "already taken" to a user who never chose the code.
    const attempts = isCustom ? 1 : SHORT_CODE_MAX_ATTEMPTS;
    let lastCode = alias ?? '';
    for (let attempt = 0; attempt < attempts; attempt++) {
      const shortCode = alias ?? generateShortCode();
      lastCode = shortCode;
      try {
        const url = await urlRepository.create({
          originalUrl: input.originalUrl,
          shortCode,
          isCustom,
          userId: new Types.ObjectId(input.userId),
          clicks: 0,
          uniqueVisitors: 0,
          isActive: true,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          maxClicks: input.maxClicks ?? null,
        });

        // Write-through cache so the very first redirect is already served from Redis.
        await cacheService.setShortCode(shortCode, toCachePayload(url), env.cacheTtl);
        return serializeUrl(url);
      } catch (err) {
        if ((err as { code?: number })?.code === 11000) {
          if (isCustom) {
            throw ApiError.conflict(`Short code "${shortCode}" is already taken`);
          }
          continue;
        }
        throw err;
      }
    }

    throw ApiError.internal(
      `Failed to generate a unique short code after ${attempts} attempts (last tried "${lastCode}")`
    );
  },

  async list(userId: string, query: ListQuery): Promise<Paginated<SerializedUrl>> {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(query.limit) || 10)));
    const sortBy = ['createdAt', 'updatedAt', 'clicks', 'uniqueVisitors'].includes(
      query.sortBy ?? ''
    )
      ? (query.sortBy as string)
      : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const status: ListUrlsParams['status'] = ['active', 'expired'].includes(query.status ?? '')
      ? (query.status as ListUrlsParams['status'])
      : 'all';
    // Query params can arrive as objects/arrays (?search[$gt]=...); only a
    // string is a search term, anything else is ignored (never .trim()ed).
    const search =
      typeof query.search === 'string' ? query.search.trim().slice(0, 100) || undefined : undefined;

    const { items, total } = await urlRepository.list({
      userId,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
      status,
    });

    return {
      items: items.map(serializeUrl),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async get(userId: string, id: string): Promise<SerializedUrl> {
    const url = await urlRepository.findByIdAndUser(id, userId);
    if (!url) throw ApiError.notFound('URL not found');
    return serializeUrl(url);
  },

  async update(
    userId: string,
    id: string,
    patch: {
      originalUrl?: string | null;
      customAlias?: string | null;
      expiresAt?: string | null;
      maxClicks?: number | null;
      isActive?: boolean | null;
    }
  ): Promise<SerializedUrl> {
    const existing = await urlRepository.findByIdAndUser(id, userId);
    if (!existing) throw ApiError.notFound('URL not found');

    const update: Partial<{
      originalUrl: string;
      shortCode: string;
      isCustom: boolean;
      expiresAt: Date | null;
      maxClicks: number | null;
      isActive: boolean;
    }> = {};

    // `null` means "not provided" for these fields (the validator allows
    // null); only expiresAt/maxClicks treat null as "clear the value".
    if (patch.originalUrl != null) update.originalUrl = patch.originalUrl;

    let aliasChanged = false;
    if (patch.customAlias != null) {
      const alias = patch.customAlias.trim();
      if (alias !== existing.shortCode) {
        const collision = await urlRepository.findByShortCode(alias);
        if (collision && collision.id !== id) {
          throw ApiError.conflict(`Short code "${alias}" is already taken`);
        }
        update.shortCode = alias;
        update.isCustom = true;
        aliasChanged = true;
      }
    }

    if (patch.expiresAt !== undefined) {
      update.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
    }
    if (patch.maxClicks !== undefined) update.maxClicks = patch.maxClicks ?? null;
    if (patch.isActive != null) update.isActive = patch.isActive;

    let updated;
    try {
      updated = await urlRepository.updateById(id, update);
    } catch (err) {
      // Unique-index violation = a concurrent rename won the race; the
      // pre-check above is only a fast path, the index is the guarantee.
      if ((err as { code?: number })?.code === 11000) {
        throw ApiError.conflict(`Short code "${update.shortCode}" is already taken`);
      }
      throw err;
    }
    if (!updated) throw ApiError.notFound('URL not found');

    // Cache changes only after the DB update succeeded: invalidating the
    // old slug first would drop the cache for a rename that then fails.
    if (aliasChanged) {
      await cacheService.invalidateShortCode(existing.shortCode);
    }
    await cacheService.invalidateShortCode(updated.shortCode);
    if (updated.isActive) {
      await cacheService.setShortCode(updated.shortCode, toCachePayload(updated), env.cacheTtl);
    }
    return serializeUrl(updated);
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await urlRepository.findByIdAndUser(id, userId);
    if (!existing) throw ApiError.notFound('URL not found');

    // Strictly sequential, in retry-safe order. Analytics first: if the
    // URL delete then fails, the link survives and the user can retry.
    // The cache is invalidated last, after the row is gone, so a redirect
    // landing mid-delete cannot re-populate the cache from the live row.
    await analyticsRepository.deleteByUrlId(existing.id);
    await urlRepository.deleteById(existing.id);
    await cacheService.invalidateShortCode(existing.shortCode);
  },
};
