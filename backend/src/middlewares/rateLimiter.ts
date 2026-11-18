import rateLimit from 'express-rate-limit';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

/** Factory that emits a consistent 429 JSON envelope when a limit is hit. */
function createLimiter({
  windowMs,
  max,
  message = 'Too many requests, please try again later',
}: RateLimitOptions) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message });
    },
  });
}

export const apiLimiter = createLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_MAX ?? 100),
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10),
  message: 'Too many authentication attempts, please try again later',
});

export const shortenLimiter = createLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_SHORTEN_MAX ?? 30),
  message: 'You are creating links too quickly, slow down',
});

export const redirectLimiter = createLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_REDIRECT_MAX ?? 120),
});
