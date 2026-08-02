import { Schema, model, type Document } from 'mongoose';
import type { Types } from 'mongoose';

export interface IUrl {
  originalUrl: string;
  shortCode: string;
  isCustom: boolean;
  userId: Types.ObjectId;
  clicks: number;
  uniqueVisitors: number;
  isActive: boolean;
  expiresAt: Date | null;
  maxClicks: number | null;
}

export interface IUrlDoc extends IUrl, Document {}

const urlSchema = new Schema<IUrlDoc>(
  {
    originalUrl: { type: String, required: true, trim: true },
    shortCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    /** True when the user supplied a custom alias instead of a random code. */
    isCustom: { type: Boolean, default: false },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clicks: { type: Number, default: 0, min: 0 },
    uniqueVisitors: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    maxClicks: { type: Number, default: null, min: 1 },
  },
  { timestamps: true }
);

/**
 * Indexes:
 * - { shortCode: 1 } unique -> O(1) lookup on the redirect hot path and
 *   enforces alias uniqueness (duplicate alias validation).
 * - { userId: 1, createdAt: -1 } -> powers the dashboard list with
 *   pagination + "newest first" sorting for a single user.
 * - { expiresAt: 1 } -> supports the scheduled expiry-sweeper query
 *   (isActive + expiresAt <= now).
 */
urlSchema.index({ shortCode: 1 }, { unique: true });
urlSchema.index({ userId: 1, createdAt: -1 });
urlSchema.index({ expiresAt: 1 });

export const UrlModel = model<IUrlDoc>('Url', urlSchema);
