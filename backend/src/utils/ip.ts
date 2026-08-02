import type { Request } from 'express';

/**
 * Resolve the real client IP behind common proxies (Render/Vercel, nginx).
 * Falls back to the raw socket address when no proxy headers exist.
 */
export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}
