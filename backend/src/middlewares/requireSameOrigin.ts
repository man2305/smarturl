import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

/**
 * CSRF guard for the cookie-based auth endpoints. Browsers always send an
 * Origin header on cross-site POSTs, so a request carrying an Origin other
 * than the frontend is rejected. Requests with no Origin (curl, mobile apps,
 * same-origin navigations) are allowed through.
 */
export function requireSameOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && origin !== env.clientUrl) {
    return next(ApiError.forbidden('Cross-origin request forbidden'));
  }
  return next();
}
