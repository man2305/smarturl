// Runs before every test file's imports, so values set here are visible to
// modules that read process.env at load time (config/env, rateLimiter).
// Rate limits are raised, not disabled: tests must still pass through the
// real limiter middleware, just with headroom for bulk/concurrency tests.
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_AUTH_MAX = '100000';
process.env.RATE_LIMIT_SHORTEN_MAX = '100000';
process.env.RATE_LIMIT_REDIRECT_MAX = '100000';
process.env.RATE_LIMIT_REFRESH_MAX = '100000';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_only';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_only';
// Vitest/Vite sets BASE_URL='/' in its own environment; pin the app's
// origins explicitly so tests never inherit the runner's values.
process.env.BASE_URL = 'http://localhost:5000';
process.env.CLIENT_URL = 'http://localhost:5173';
