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

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < SHORT_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateShortCode();
    const existing = await urlRepository.findByShortCode(code);
    if (!existing) return code;
  }
  throw ApiError.internal('Failed to generate a unique short code');
}

export const urlService = {
  async shorten(input: ShortenInput): Promise<SerializedUrl> {
    const isCustom = Boolean(input.customAlias);
    const shortCode = isCustom ? (input.customAlias as string).trim() : await generateUniqueCode();

    let url;
    try {
      url = await urlRepository.create({
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
    } catch (err) {
      // Unique-index violation = alias race/late collision -> friendly 409.
      if ((err as { code?: number })?.code === 11000) {
        throw ApiError.conflict(`Short code "${shortCode}" is already taken`);
      }
      throw err;
    }

    // Write-through cache so the very first redirect is already served from Redis.
    await cacheService.setShortCode(shortCode, toCachePayload(url), env.cacheTtl);
    return serializeUrl(url);
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

    const { items, total } = await urlRepository.list({
      userId,
      search: query.search,
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
      originalUrl?: string;
      customAlias?: string;
      expiresAt?: string | null;
      maxClicks?: number | null;
      isActive?: boolean;
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

    if (patch.originalUrl !== undefined) update.originalUrl = patch.originalUrl;

    if (patch.customAlias !== undefined) {
      const alias = patch.customAlias.trim();
      if (alias !== existing.shortCode) {
        const collision = await urlRepository.findByShortCode(alias);
        if (collision && collision.id !== id) {
          throw ApiError.conflict(`Short code "${alias}" is already taken`);
        }
        await cacheService.invalidateShortCode(existing.shortCode);
        update.shortCode = alias;
        update.isCustom = true;
      }
    }

    if (patch.expiresAt !== undefined) {
      update.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
    }
    if (patch.maxClicks !== undefined) update.maxClicks = patch.maxClicks ?? null;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;

    const updated = await urlRepository.updateById(id, update);
    if (!updated) throw ApiError.notFound('URL not found');

    await cacheService.invalidateShortCode(updated.shortCode);
    if (updated.isActive) {
      await cacheService.setShortCode(updated.shortCode, toCachePayload(updated), env.cacheTtl);
    }
    return serializeUrl(updated);
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await urlRepository.findByIdAndUser(id, userId);
    if (!existing) throw ApiError.notFound('URL not found');

    // Cascade delete analytics + link, then drop the cached entry.
    await Promise.all([
      analyticsRepository.deleteByUrlId(existing.id),
      urlRepository.deleteById(existing.id),
      cacheService.invalidateShortCode(existing.shortCode),
    ]);
  },
};
