import { env } from '../config/env';

/** Loose projection of a Url document or aggregation row. */
export interface UrlLike {
  _id: unknown;
  originalUrl: string;
  shortCode: string;
  isCustom?: boolean;
  clicks?: number;
  uniqueVisitors?: number;
  isActive?: boolean;
  expiresAt?: Date | string | null;
  maxClicks?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SerializedUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  isCustom: boolean;
  clicks: number;
  uniqueVisitors: number;
  isActive: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Consistent JSON shape for every URL returned by the API. */
export function serializeUrl(u: UrlLike): SerializedUrl {
  return {
    id: String(u._id),
    originalUrl: u.originalUrl,
    shortCode: u.shortCode,
    shortUrl: `${env.baseUrl}/${u.shortCode}`,
    isCustom: u.isCustom ?? false,
    clicks: u.clicks ?? 0,
    uniqueVisitors: u.uniqueVisitors ?? 0,
    isActive: u.isActive ?? true,
    expiresAt: u.expiresAt ? new Date(u.expiresAt).toISOString() : null,
    maxClicks: u.maxClicks ?? null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : undefined,
  };
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  createdAt?: string;
}

/** Never leak the password hash outside the auth boundary. */
export function serializeUser(u: {
  _id: unknown;
  name: string;
  email: string;
  isEmailVerified?: boolean;
  createdAt?: Date | string;
}): PublicUser {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    isEmailVerified: u.isEmailVerified ?? false,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
  };
}
