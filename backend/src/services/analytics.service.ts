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
  ip: string;
  userAgent?: string;
  referrer?: string;
}

/**
 * Fire-and-forget click recording (never blocks the redirect).
 * Failures are logged and swallowed so analytics outages never break links.
 */
export async function recordClick(ctx: ClickContext): Promise<void> {
  try {
    const { browser, browserVersion, os, device, deviceName } = parseUserAgent(ctx.userAgent);
    const { country, countryCode } = lookupCountry(ctx.ip);

    let isNewVisitor = false;
    if (isRedisEnabled()) {
      // Redis set SADD is atomic — perfect for O(1) unique dedup.
      isNewVisitor = await cacheService.isNewVisitor(ctx.urlId, ctx.ip);
    } else if (ctx.ip) {
      isNewVisitor = await analyticsRepository.isFirstVisitByIp(ctx.urlId, ctx.ip);
    }

    await Promise.all([
      urlRepository.incrementCounters(ctx.urlId, {
        clicks: 1,
        uniqueVisitors: isNewVisitor ? 1 : 0,
      }),
      analyticsRepository.create({
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
      }),
    ]);

    // Click-budget expiry: atomically deactivate when the cap is reached.
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
    analyticsRepository.getDimensionBreakdown(urlId, 'browser'),
    analyticsRepository.getDimensionBreakdown(urlId, 'device'),
    analyticsRepository.getDimensionBreakdown(urlId, 'os'),
    analyticsRepository.getDimensionBreakdown(urlId, 'country'),
    analyticsRepository.getDimensionBreakdown(urlId, 'referrer'),
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
      analyticsRepository.getDimensionBreakdownByUser(userId, 'browser'),
      analyticsRepository.getDimensionBreakdownByUser(userId, 'device'),
      analyticsRepository.getDimensionBreakdownByUser(userId, 'os'),
      analyticsRepository.getDimensionBreakdownByUser(userId, 'country'),
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
