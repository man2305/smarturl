import 'dotenv/config';
import { CACHE_TTL } from './constants';

/**
 * Centralised, typed access to environment variables.
 * Safe defaults for local dev; fail-fast (throw at boot) when a production
 * variable is missing or still set to a development default — misconfiguration
 * should never reach the network silently.
 */
const VALID_NODE_ENVS = ['development', 'test', 'production'] as const;
type NodeEnv = (typeof VALID_NODE_ENVS)[number];

const rawNodeEnv = process.env.NODE_ENV ?? 'development';
if (!(VALID_NODE_ENVS as readonly string[]).includes(rawNodeEnv)) {
  throw new Error(
    `[env] NODE_ENV must be one of ${VALID_NODE_ENVS.join(', ')}, got "${rawNodeEnv}"`
  );
}
const nodeEnv = rawNodeEnv as NodeEnv;
const isProduction = nodeEnv === 'production';

function requireEnv(
  name: string,
  fallback: string,
  weakDefaults: string[] = [],
  opts: { optional?: boolean } = {}
): string {
  // A blank value is the same as an unset one: some tooling (notably Vite)
  // sets BASE_URL to '/' in its own environment, which must never leak in
  // as the API origin.
  const raw = process.env[name];
  const value = raw && raw.trim().length > 0 ? raw.trim() : fallback;

  if (isProduction) {
    if (!value && !opts.optional) throw new Error(`[env] ${name} is required in production`);
    if (value && weakDefaults.includes(value)) {
      throw new Error(
        `[env] ${name} is still set to a development default; provide a real production value`
      );
    }
  }

  return value;
}

/**
 * Strict numeric env parsing. `Number('abc')` is NaN, and a NaN rate-limit
 * cap silently disables the limiter (`hits > NaN` is always false), so a
 * typo here must fail the boot, not the protection.
 */
function requireNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`[env] ${name} must be an integer between ${min} and ${max}, got "${raw}"`);
  }
  return value;
}

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parse a jsonwebtoken-style duration ('15m', '7d', or bare seconds) to
 * milliseconds. Throws on anything unparseable, so a typo in a JWT expiry
 * fails the boot instead of 500ing every login at runtime.
 */
export function parseDurationToMs(name: string, value: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const match = /^(\d+)(ms|s|m|h|d|w)$/.exec(trimmed);
  if (!match) {
    throw new Error(`[env] ${name} must be a duration like "15m" or "7d", got "${value}"`);
  }
  return Number(match[1]) * DURATION_UNITS[match[2]];
}

/**
 * Trailing slashes break CORS origin matching (Origin headers carry no
 * trailing slash) and double up redirect targets, so strip them at boot.
 */
function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

export const env = {
  nodeEnv,
  isProduction,

  port: requireNumber('PORT', 5000, 1, 65535),
  baseUrl: stripTrailingSlash(
    requireEnv('BASE_URL', 'http://localhost:5000', ['http://localhost:5000'])
  ),
  clientUrl: stripTrailingSlash(
    requireEnv('CLIENT_URL', 'http://localhost:5173', ['http://localhost:5173'])
  ),

  mongoUri: requireEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/smarturl', [
    'mongodb://127.0.0.1:27017/smarturl',
  ]),
  // Redis is optional by design (the app degrades to DB-only lookups),
  // so an empty value must not fail a production boot.
  redisUrl: requireEnv('REDIS_URL', '', [], { optional: true }),
  cacheTtl: requireNumber('CACHE_TTL', CACHE_TTL, 1, 31536000),

  rateLimits: {
    api: requireNumber('RATE_LIMIT_MAX', 100, 1, 1000000),
    auth: requireNumber('RATE_LIMIT_AUTH_MAX', 10, 1, 1000000),
    shorten: requireNumber('RATE_LIMIT_SHORTEN_MAX', 30, 1, 1000000),
    redirect: requireNumber('RATE_LIMIT_REDIRECT_MAX', 120, 1, 1000000),
    refresh: requireNumber('RATE_LIMIT_REFRESH_MAX', 60, 1, 1000000),
  },

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev_access_secret', [
      'dev_access_secret',
      'change_me_access_secret',
    ]),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret', [
      'dev_refresh_secret',
      'change_me_refresh_secret',
    ]),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn,
    // Single source for the refresh-token lifetime: the cookie max-age and
    // the stored-token TTL both derive from this, so they cannot drift
    // apart when JWT_REFRESH_EXPIRES_IN changes.
    refreshTtlMs: parseDurationToMs('JWT_REFRESH_EXPIRES_IN', refreshExpiresIn),
    issuer: process.env.JWT_ISSUER ?? 'smarturl',
    audience: process.env.JWT_AUDIENCE ?? 'smarturl-api',
  },
} as const;

// The access-token expiry is only used at sign time; validate it now so a
// bad value fails the boot instead of every login.
parseDurationToMs('JWT_ACCESS_EXPIRES_IN', env.jwt.accessExpiresIn);

// The two token types are only distinct if their secrets are distinct:
// with equal secrets a refresh token could pass as an access token.
if (env.jwt.accessSecret === env.jwt.refreshSecret) {
  throw new Error('[env] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
}

// A short secret is brute-forceable no matter how random it looks.
if (isProduction) {
  for (const [name, secret] of [
    ['JWT_ACCESS_SECRET', env.jwt.accessSecret],
    ['JWT_REFRESH_SECRET', env.jwt.refreshSecret],
  ] as const) {
    if (secret.length < 32) {
      throw new Error(`[env] ${name} must be at least 32 characters in production`);
    }
  }
}

// baseUrl builds every shortUrl and clientUrl is the CORS origin: a
// non-URL value here (e.g. Vite's BASE_URL='/') would silently corrupt
// links or lock the frontend out, so fail fast instead.
function assertHttpUrl(name: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[env] ${name} must be a valid http(s) URL, got "${value}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`[env] ${name} must be a valid http(s) URL, got "${value}"`);
  }
}

assertHttpUrl('BASE_URL', env.baseUrl);
assertHttpUrl('CLIENT_URL', env.clientUrl);
