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

/** Cookie max-age: 7 days in ms. */
export const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Slug character whitelist for custom aliases (URL-safe Base62-ish). */
export const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

/** Random slug collision retries before giving up. */
export const SHORT_CODE_MAX_ATTEMPTS = 5;
