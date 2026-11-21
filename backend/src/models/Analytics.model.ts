import { Schema, model, type Document } from 'mongoose';
import type { Types } from 'mongoose';

export interface IAnalytics {
  urlId: Types.ObjectId;
  userId: Types.ObjectId;
  ip: string;
  userAgent: string;
  referrer: string | null;
  browser: string;
  browserVersion: string;
  os: string;
  device: string; // desktop | mobile | tablet
  deviceName: string;
  country: string;
  countryCode: string;
  clickedAt: Date;
}

export interface IAnalyticsDoc extends IAnalytics, Document {}

const analyticsSchema = new Schema<IAnalyticsDoc>(
  {
    urlId: { type: Schema.Types.ObjectId, ref: 'Url', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ip: { type: String },
    userAgent: { type: String, default: '' },
    referrer: { type: String, default: null },
    browser: { type: String, default: 'Unknown' },
    browserVersion: { type: String, default: '' },
    os: { type: String, default: 'Unknown' },
    device: {
      type: String,
      default: 'desktop',
      enum: ['desktop', 'mobile', 'tablet', 'other'],
    },
    deviceName: { type: String, default: '' },
    country: { type: String, default: 'Unknown' },
    countryCode: { type: String, default: '' },
    clickedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

/**
 * Indexes - each powers a specific aggregation on the analytics page:
 * - { urlId: 1, clickedAt: -1 } -> daily click series (time-bucket group).
 * - { urlId: 1, browser: 1 } | device | os | country -> dimension breakdowns.
 * - { urlId: 1, referrer: 1 } -> referrer report.
 * Together they keep dashboard aggregations index-covered per link.
 */
analyticsSchema.index({ urlId: 1, clickedAt: -1 });
analyticsSchema.index({ urlId: 1, browser: 1 });
analyticsSchema.index({ urlId: 1, device: 1 });
analyticsSchema.index({ urlId: 1, os: 1 });
analyticsSchema.index({ urlId: 1, country: 1 });
analyticsSchema.index({ urlId: 1, referrer: 1 });
// User-level aggregations (overview, recent activity) filter by userId
// alone; without this they collection-scan the ever-growing click log.
analyticsSchema.index({ userId: 1, clickedAt: -1 });
// No-Redis unique-visitor fallback: isFirstVisitByIp counts by (urlId, ip).
analyticsSchema.index({ urlId: 1, ip: 1 });

export const AnalyticsModel = model<IAnalyticsDoc>('Analytics', analyticsSchema);
