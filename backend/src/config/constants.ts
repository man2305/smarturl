/**
 * Application-wide constants.
 * Kept in one place so tuning (slug length, TTLs, cookie names) is trivial.
 */

/** Length of randomly generated short codes. */
export const SHORT_CODE_LENGTH = 7;

/** TTL (seconds) for cached short-link payloads. */
export const CACHE_TTL = 86400;

/** TTL (seconds) for negative cache entries (missed slugs). */
export const NEGATIVE_CACHE_TTL = 60;

/** TTL (seconds) for the Redis set used to dedupe unique visitors per URL. */
export const UNIQUE_VISITOR_TTL = 86400 * 30;

/** Name of the httpOnly refresh-token cookie. */
export const REFRESH_TOKEN_COOKIE = 'smarturl_refresh';

/** Slug character whitelist for custom aliases (URL-safe Base62-ish). */
export const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

/**
 * Aliases that must never be user-chosen: they collide with API routes,
 * frontend routes, or well-known paths, and a redirect slug at the root
 * would shadow them.
 */
export const RESERVED_ALIASES = new Set([
  'api',
  'auth',
  'login',
  'logout',
  'register',
  'admin',
  'dashboard',
  'analytics',
  'urls',
  'health',
  'settings',
  'link-unavailable',
  'app',
  'static',
  'public',
  'www',
  'smarturl',
]);

/** Random slug collision retries before giving up. */
export const SHORT_CODE_MAX_ATTEMPTS = 5;

/**
 * Reuse grace window for refresh tokens (ms). A token presented again
 * within this window after rotation is treated as a concurrent legitimate
 * refresh (e.g. two tabs) and rejected without revoking the family;
 * reuse after the window is treated as token theft and revokes the
 * whole token family.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;
