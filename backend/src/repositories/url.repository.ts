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

/** Escape user input before it becomes a $regex: unescaped input is regex injection (e.g. `.*` matches everything) and a ReDoS vector. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      { $inc: { clicks: Math.max(0, clicks), uniqueVisitors: Math.max(0, uniqueVisitors) } }
    ).exec();
  },

  /**
   * Atomically claim one click against a link's budget. The filter only
   * matches while clicks are below the cap, so exactly (cap - clicks)
   * concurrent claims succeed — the cap cannot overshoot. The same update
   * deactivates the link the moment the cap is reached. Returns the
   * updated document, or null when the budget is spent (or the link is
   * inactive/gone).
   */
  async claimClick(id: string, maxClicks: number): Promise<IUrlDoc | null> {
    return UrlModel.findOneAndUpdate(
      { _id: id, isActive: true, clicks: { $lt: maxClicks } },
      [
        {
          $set: {
            clicks: { $add: ['$clicks', 1] },
            isActive: {
              $cond: [{ $gte: [{ $add: ['$clicks', 1] }, maxClicks] }, false, true],
            },
          },
        },
      ],
      { new: true }
    ).exec();
  },

  async deactivate(id: string): Promise<void> {
    await UrlModel.updateOne({ _id: id }, { $set: { isActive: false } }).exec();
  },

  /**
   * Sweep: deactivate links whose date or click budget has been reached.
   * The null guards are load-bearing: in $expr semantics null sorts below
   * every date, so `$lte: ['$expiresAt', now]` without a guard matches
   * every permanent link and the sweeper would deactivate all of them.
   * The plain-query form also lets Mongo use the { expiresAt: 1 } index.
   */
  async deactivateExpired(now = new Date()): Promise<number> {
    const result = await UrlModel.updateMany(
      {
        isActive: true,
        $or: [
          { expiresAt: { $ne: null, $lte: now } },
          { maxClicks: { $ne: null }, $expr: { $gte: ['$clicks', '$maxClicks'] } },
        ],
      },
      { $set: { isActive: false } }
    ).exec();
    return result.modifiedCount ?? 0;
  },

  async list(params: ListUrlsParams): Promise<ListUrlsResult> {
    const { userId, search, page, limit, sortBy, sortOrder, status } = params;

    const filter: Record<string, unknown> = { userId };
    if (search) {
      const pattern = escapeRegExp(search);
      filter.$or = [
        { originalUrl: { $regex: pattern, $options: 'i' } },
        { shortCode: { $regex: pattern, $options: 'i' } },
      ];
    }
    if (status === 'active') filter.isActive = true;
    if (status === 'expired') filter.isActive = false;

    const sortField = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    // _id tiebreaker: without it, ties on clicks/createdAt resolve
    // arbitrarily and rows can repeat or vanish across pages.
    const sort: Record<string, SortOrder> = { [sortField]: sortOrder, _id: 1 };

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
