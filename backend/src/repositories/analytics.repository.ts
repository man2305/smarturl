import { Types } from 'mongoose';
import { AnalyticsModel, type IAnalytics } from '../models/Analytics.model';
import { UrlModel } from '../models/Url.model';

/** Whitelist of aggregation dimensions (prevents injection into $group keys). */
const DIMENSIONS = new Set(['browser', 'os', 'device', 'country', 'referrer']);

const toObjectId = (id: string) => new Types.ObjectId(id);

export const analyticsRepository = {
  async create(entry: Partial<IAnalytics>): Promise<void> {
    await AnalyticsModel.create(entry);
  },

  async deleteByUrlId(urlId: string): Promise<void> {
    await AnalyticsModel.deleteMany({ urlId }).exec();
  },

  async deleteByUserId(userId: string): Promise<void> {
    await AnalyticsModel.deleteMany({ userId }).exec();
  },

  /** Cross-link totals for the dashboard hero stats. */
  async overview(userId: string): Promise<{
    totalClicks: number;
    totalUniqueVisitors: number;
    totalLinks: number;
    activeLinks: number;
  }> {
    const [result] = await UrlModel.aggregate<{
      totalClicks: number;
      totalUniqueVisitors: number;
      totalLinks: number;
      activeLinks: number;
    }>([
      { $match: { userId: toObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: '$clicks' },
          totalUniqueVisitors: { $sum: '$uniqueVisitors' },
          totalLinks: { $sum: 1 },
          activeLinks: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]).exec();

    return result ?? { totalClicks: 0, totalUniqueVisitors: 0, totalLinks: 0, activeLinks: 0 };
  },

  async topLinks(userId: string, limit: number) {
    return UrlModel.aggregate([
      { $match: { userId: toObjectId(userId) } },
      { $sort: { clicks: -1 } },
      { $limit: limit },
      {
        $project: {
          originalUrl: 1,
          shortCode: 1,
          clicks: 1,
          uniqueVisitors: 1,
          isActive: 1,
          createdAt: 1,
        },
      },
    ]).exec();
  },

  async recentActivity(userId: string, limit: number) {
    return AnalyticsModel.aggregate([
      { $match: { userId: toObjectId(userId) } },
      { $sort: { clickedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'urls',
          localField: 'urlId',
          foreignField: '_id',
          as: 'url',
        },
      },
      { $unwind: '$url' },
      {
        $project: {
          shortCode: '$url.shortCode',
          originalUrl: '$url.originalUrl',
          browser: 1,
          os: 1,
          country: 1,
          device: 1,
          clickedAt: 1,
        },
      },
    ]).exec();
  },

  async getDailyClicks(urlId: string, since: Date) {
    return AnalyticsModel.aggregate<{ date: string; clicks: number }>([
      { $match: { urlId: toObjectId(urlId), clickedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
          clicks: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', clicks: 1 } },
      { $sort: { date: 1 } },
    ]).exec();
  },

  async getDimensionBreakdown(urlId: string, field: string, limit = 8) {
    if (!DIMENSIONS.has(field)) return [];
    return AnalyticsModel.aggregate<{ name: string; value: number; countryCode?: string }>([
      { $match: { urlId: toObjectId(urlId) } },
      { $group: { _id: `$${field}`, value: { $sum: 1 } } },
      {
        $project: {
          name: '$_id',
          value: 1,
          countryCode: field === 'country' ? '$countryCode' : undefined,
          _id: 0,
        },
      },
      { $sort: { value: -1 } },
      { $limit: limit },
    ]).exec();
  },

  async countByUrlId(urlId: string): Promise<number> {
    return AnalyticsModel.countDocuments({ urlId }).exec();
  },

  /** Daily click series across ALL of a user's links (aggregate dashboard). */
  async getDailyClicksByUser(userId: string, since: Date) {
    return AnalyticsModel.aggregate<{ date: string; clicks: number }>([
      { $match: { userId: toObjectId(userId), clickedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
          clicks: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', clicks: 1 } },
      { $sort: { date: 1 } },
    ]).exec();
  },

  /** Dimension breakdown across ALL of a user's links. */
  async getDimensionBreakdownByUser(userId: string, field: string, limit = 8) {
    if (!DIMENSIONS.has(field)) return [];
    return AnalyticsModel.aggregate<{ name: string; value: number; countryCode?: string }>([
      { $match: { userId: toObjectId(userId) } },
      { $group: { _id: `$${field}`, value: { $sum: 1 } } },
      {
        $project: {
          name: '$_id',
          value: 1,
          countryCode: field === 'country' ? '$countryCode' : undefined,
          _id: 0,
        },
      },
      { $sort: { value: -1 } },
      { $limit: limit },
    ]).exec();
  },

  /** DB fallback for unique-visitor dedup when Redis is unavailable. */
  async isFirstVisitByIp(urlId: string, ip: string): Promise<boolean> {
    if (!ip) return false;
    const count = await AnalyticsModel.countDocuments({ urlId, ip }).exec();
    return count === 0;
  },
};
