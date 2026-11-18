import 'dotenv/config';

/**
 * Centralised, typed access to environment variables.
 * Safe defaults for local dev; fail-fast (throw at boot) when a production
 * variable is missing or still set to a development default — misconfiguration
 * should never reach the network silently.
 */
const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function requireEnv(name: string, fallback: string, weakDefaults: string[] = []): string {
  // A blank value is the same as an unset one: some tooling (notably Vite)
  // sets BASE_URL to '/' in its own environment, which must never leak in
  // as the API origin.
  const raw = process.env[name];
  const value = raw && raw.trim().length > 0 ? raw.trim() : fallback;

  if (isProduction) {
    if (!value) throw new Error(`[env] ${name} is required in production`);
    if (weakDefaults.includes(value)) {
      throw new Error(
        `[env] ${name} is still set to a development default; provide a real production value`
      );
    }
  }

  return value;
}

export const env = {
  nodeEnv,
  isProduction,

  port: Number(process.env.PORT ?? 5000),
  baseUrl: requireEnv('BASE_URL', 'http://localhost:5000', ['http://localhost:5000']),
  clientUrl: requireEnv('CLIENT_URL', 'http://localhost:5173', ['http://localhost:5173']),

  mongoUri: requireEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/smarturl', [
    'mongodb://127.0.0.1:27017/smarturl',
  ]),
  redisUrl: requireEnv('REDIS_URL', '', []),
  cacheTtl: Number(process.env.CACHE_TTL ?? 86400),

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
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    issuer: process.env.JWT_ISSUER ?? 'smarturl',
    audience: process.env.JWT_AUDIENCE ?? 'smarturl-api',
  },
} as const;

// The two token types are only distinct if their secrets are distinct:
// with equal secrets a refresh token could pass as an access token.
if (env.jwt.accessSecret === env.jwt.refreshSecret) {
  throw new Error('[env] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
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
