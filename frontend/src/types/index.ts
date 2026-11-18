/** Shared API contract types mirroring the backend serializers. */

export interface User {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  createdAt?: string;
}

export interface ShortUrl {
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

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface OverviewData {
  overview: {
    totalClicks: number;
    totalUniqueVisitors: number;
    totalLinks: number;
    activeLinks: number;
  };
  topLinks: ShortUrl[];
  daily: { date: string; clicks: number }[];
  browsers: DimensionItem[];
  devices: DimensionItem[];
  os: DimensionItem[];
  countries: DimensionItem[];
  recentActivity: {
    shortCode: string;
    originalUrl: string;
    browser: string;
    os: string;
    country: string;
    device: string;
    clickedAt: string;
  }[];
}

export interface DimensionItem {
  name: string;
  value: number;
  countryCode?: string;
}

export interface UrlAnalytics {
  url: ShortUrl;
  totalClicks: number;
  daily: { date: string; clicks: number }[];
  browsers: DimensionItem[];
  devices: DimensionItem[];
  os: DimensionItem[];
  countries: DimensionItem[];
  referrers: DimensionItem[];
}
