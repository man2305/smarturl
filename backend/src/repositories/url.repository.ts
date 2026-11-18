import { UrlModel, type IUrl, type IUrlDoc } from '../models/Url.model';
import type { SortOrder } from './types';

/**
 * Fields a URL update may change. Counters and ownership are deliberately
 * excluded: no caller should be able to patch clicks, uniqueVisitors or
 * userId through the update path.
 */
export interface UrlPatch {
  originalUrl?: string;
  shortCode?: string;
  isCustom?: boolean;
  expiresAt?: Date | null;
  maxClicks?: number | null;
  isActive?: boolean;
}

export interface ListUrlsParams {
  userId: string;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: SortOrder;
  /** 'all' | 'active' | 'expired' */
  status: string;
}

export interface ListUrlsResult {
  items: IUrlDoc[];
  total: number;
}

const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'clicks', 'uniqueVisitors']);

export const urlRepository = {
  async create(data: Partial<IUrl>): Promise<IUrlDoc> {
    return UrlModel.create(data);
  },

  async findByShortCode(shortCode: string): Promise<IUrlDoc | null> {
    return UrlModel.findOne({ shortCode }).exec();
  },

  async findById(id: string): Promise<IUrlDoc | null> {
    return UrlModel.findById(id).exec();
  },

  async findByIdAndUser(id: string, userId: string): Promise<IUrlDoc | null> {
    return UrlModel.findOne({ _id: id, userId }).exec();
  },

  async updateById(id: string, patch: UrlPatch): Promise<IUrlDoc | null> {
    return UrlModel.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).exec();
  },

  async deleteById(id: string): Promise<IUrlDoc | null> {
    return UrlModel.findByIdAndDelete(id).exec();
  },

  /** Atomic counters — no read-modify-write race on the hot redirect path. */
  async incrementCounters(
    id: string,
    { clicks = 0, uniqueVisitors = 0 }: { clicks?: number; uniqueVisitors?: number }
  ): Promise<void> {
    await UrlModel.updateOne(
      { _id: id },
      { $inc: { clicks, uniqueVisitors } }
    ).exec();
  },

  async deactivate(id: string): Promise<void> {
    await UrlModel.updateOne({ _id: id }, { $set: { isActive: false } }).exec();
  },

  /** Sweep: deactivate links whose date or click budget has been reached. */
  async deactivateExpired(now = new Date()): Promise<number> {
    const result = await UrlModel.updateMany(
      {
        isActive: true,
        $expr: {
          $or: [{ $lte: ['$expiresAt', now] }, { $and: [{ $ne: ['$maxClicks', null] }, { $gte: ['$clicks', '$maxClicks'] }] }],
        },
      },
      { $set: { isActive: false } }
    ).exec();
    return result.modifiedCount ?? 0;
  },

  async list(params: ListUrlsParams): Promise<ListUrlsResult> {
    const { userId, search, page, limit, sortBy, sortOrder, status } = params;

    const filter: Record<string, unknown> = { userId };
    if (search) {
      filter.$or = [
        { originalUrl: { $regex: search, $options: 'i' } },
        { shortCode: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'active') filter.isActive = true;
    if (status === 'expired') filter.isActive = false;

    const sortField = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const sort: Record<string, SortOrder> = { [sortField]: sortOrder };

    const [items, total] = await Promise.all([
      UrlModel.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      UrlModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  },
};
