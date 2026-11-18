import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/** Factory that emits a consistent 429 JSON envelope when a limit is hit. */
function createLimiter({
  windowMs,
  max,
  message = 'Too many requests, please try again later',
  keyGenerator,
}: RateLimitOptions) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, res) => {
      res.status(429).json({ success: false, message });
    },
  });
}

export const apiLimiter = createLimiter({
  windowMs: 60_000,
  max: env.rateLimits.api,
});

// Separate instances so register spam cannot consume the login budget.
export const loginLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: env.rateLimits.auth,
  message: 'Too many login attempts, please try again later',
});

export const registerLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: env.rateLimits.auth,
  message: 'Too many registration attempts, please try again later',
});

// Refresh/logout are cookie-based and unauthenticated by Bearer token, so
// they need their own budget: unbounded refresh is unbounded DB churn.
export const refreshLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: env.rateLimits.refresh,
  message: 'Too many refresh attempts, please try again later',
});

export const shortenLimiter = createLimiter({
  windowMs: 60_000,
  max: env.rateLimits.shorten,
  message: 'You are creating links too quickly, slow down',
  // authenticate runs before this limiter, so per-user buckets are safe
  // and users behind one NAT no longer share a budget; requests without
  // a user (shouldn't happen) fall back to IP.
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

export const redirectLimiter = createLimiter({
  windowMs: 60_000,
  max: env.rateLimits.redirect,
});
