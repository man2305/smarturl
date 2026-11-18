import { Types } from 'mongoose';
import { urlRepository } from '../repositories/url.repository';
import { analyticsRepository } from '../repositories/analytics.repository';
import { cacheService } from './cache.service';
import { parseUserAgent } from '../utils/device';
import { lookupCountry } from '../utils/geo';
import { serializeUrl, type SerializedUrl } from '../utils/serializers';
import { ApiError } from '../utils/ApiError';
import { isRedisEnabled } from '../config/redis';
import { UrlModel } from '../models/Url.model';

export interface ClickContext {
  urlId: string;
  userId: string;
  shortCode: string;
  maxClicks: number | null;
  /** True when the redirect already consumed one click of the budget. */
  clickClaimed: boolean;
  ip: string;
  userAgent?: string;
  referrer?: string;
}

/**
 * Unique-visitor check. Redis SADD is atomic and O(1); when Redis is down
 * or errors, fall back to the database check instead of silently
 * undercounting. The DB fallback is check-then-insert, so two concurrent
 * first visits from one IP in no-Redis mode can over-count by one — an
 * accepted best-effort trade-off (see TESTING.md).
 */
async function checkNewVisitor(urlId: string, ip: string): Promise<boolean> {
  if (!ip) return false;
  if (isRedisEnabled()) {
    try {
      return await cacheService.isNewVisitor(urlId, ip);
    } catch {
      // Fall through to the database check.
    }
  }
  try {
    return await analyticsRepository.isFirstVisitByIp(urlId, ip);
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget click recording (never blocks the redirect).
 * Failures are logged per step and swallowed so analytics outages never
 * break links. The event row is written first: if it fails, the counters
 * stay untouched, so the two sources cannot disagree by a phantom click.
 * (Without replica-set transactions the two writes cannot be made
 * atomic; this ordering keeps the richer record authoritative.)
 */
export async function recordClick(ctx: ClickContext): Promise<void> {
  try {
    const { browser, browserVersion, os, device, deviceName } = parseUserAgent(ctx.userAgent);
    const { country, countryCode } = lookupCountry(ctx.ip);
    const isNewVisitor = await checkNewVisitor(ctx.urlId, ctx.ip);

    try {
      await analyticsRepository.create({
        urlId: new Types.ObjectId(ctx.urlId),
        userId: new Types.ObjectId(ctx.userId),
        ip: ctx.ip,
        userAgent: ctx.userAgent ?? '',
        referrer: ctx.referrer ?? null,
        browser,
        browserVersion,
        os,
        device,
        deviceName,
        country,
        countryCode,
      });
    } catch (err) {
      console.error('[analytics] failed to store click event:', err);
      return;
    }

    const clicksInc = ctx.clickClaimed ? 0 : 1;
    const uvInc = isNewVisitor ? 1 : 0;
    if (clicksInc > 0 || uvInc > 0) {
      try {
        await urlRepository.incrementCounters(ctx.urlId, {
          clicks: clicksInc,
          uniqueVisitors: uvInc,
        });
      } catch (err) {
        console.error('[analytics] failed to increment counters:', err);
      }
    }

    // Click-budget expiry safety net: capped links are normally
    // deactivated atomically by the claim itself; this covers any path
    // that reaches the cap without claiming (e.g. a cap lowered below
    // the current count).
    if (ctx.maxClicks) {
      const deactivated = await UrlModel.updateOne(
        { _id: ctx.urlId, isActive: true, $expr: { $gte: ['$clicks', ctx.maxClicks] } },
        { $set: { isActive: false } }
      ).exec();
      if (deactivated.modifiedCount > 0) {
        await cacheService.invalidateShortCode(ctx.shortCode);
      }
    }
  } catch (err) {
    console.error('[analytics] failed to record click:', err);
  }
}

export interface UrlAnalytics {
  url: SerializedUrl;
  totalClicks: number;
  daily: { date: string; clicks: number }[];
  browsers: { name: string; value: number }[];
  devices: { name: string; value: number }[];
  os: { name: string; value: number }[];
  countries: { name: string; value: number; countryCode?: string }[];
  referrers: { name: string; value: number }[];
}

export async function getUrlAnalytics(userId: string, urlId: string, days = 30): Promise<UrlAnalytics> {
  const url = await urlRepository.findByIdAndUser(urlId, userId);
  if (!url) throw ApiError.notFound('URL not found');

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [daily, browsers, devices, os, countries, referrers, totalClicks] = await Promise.all([
    analyticsRepository.getDailyClicks(urlId, since),
    analyticsRepository.getDimensionBreakdown(urlId, 'browser', 8, since),
    analyticsRepository.getDimensionBreakdown(urlId, 'device', 8, since),
    analyticsRepository.getDimensionBreakdown(urlId, 'os', 8, since),
    analyticsRepository.getDimensionBreakdown(urlId, 'country', 8, since),
    analyticsRepository.getDimensionBreakdown(urlId, 'referrer', 8, since),
    analyticsRepository.countByUrlId(urlId),
  ]);

  return { url: serializeUrl(url), totalClicks, daily, browsers, devices, os, countries, referrers };
}

export interface Overview {
  overview: { totalClicks: number; totalUniqueVisitors: number; totalLinks: number; activeLinks: number };
  topLinks: SerializedUrl[];
  daily: { date: string; clicks: number }[];
  browsers: { name: string; value: number }[];
  devices: { name: string; value: number }[];
  os: { name: string; value: number }[];
  countries: { name: string; value: number; countryCode?: string }[];
  recentActivity: {
    shortCode: string;
    originalUrl: string;
    browser: string;
    os: string;
    country: string;
    device: string;
    clickedAt: Date;
  }[];
}

export async function getOverview(userId: string, topLimit = 5): Promise<Overview> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [overview, topLinks, recentActivity, daily, browsers, devices, os, countries] =
    await Promise.all([
      analyticsRepository.overview(userId),
      analyticsRepository.topLinks(userId, topLimit),
      analyticsRepository.recentActivity(userId, 8),
      analyticsRepository.getDailyClicksByUser(userId, since),
      analyticsRepository.getDimensionBreakdownByUser(userId, 'browser', 8, since),
      analyticsRepository.getDimensionBreakdownByUser(userId, 'device', 8, since),
      analyticsRepository.getDimensionBreakdownByUser(userId, 'os', 8, since),
      analyticsRepository.getDimensionBreakdownByUser(userId, 'country', 8, since),
    ]);

  return {
    overview,
    topLinks: topLinks.map(serializeUrl),
    daily,
    browsers,
    devices,
    os,
    countries,
    recentActivity,
  };
}
