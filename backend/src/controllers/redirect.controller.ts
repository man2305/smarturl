import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { resolveShortCode } from '../services/redirect.service';
import { recordClick } from '../services/analytics.service';
import { getClientIp } from '../utils/ip';
import { ALIAS_REGEX } from '../config/constants';
import { env } from '../config/env';

/**
 * GET /:shortCode
 *
 * Resolves a slug and 302-redirects to its destination.
 * Analytics are recorded fire-and-forget so telemetry never blocks the user.
 * `Cache-Control: no-store` prevents proxies/browsers from caching the 302,
 * which would otherwise swallow future analytics.
 */
export const redirect = asyncHandler(async (req: Request, res: Response) => {
  // Slugs outside the alias shape can never exist (random codes and custom
  // aliases both match ALIAS_REGEX); reject before touching Redis/Mongo so
  // junk paths like /favicon.ico don't cost a lookup each.
  if (!ALIAS_REGEX.test(req.params.shortCode)) {
    throw ApiError.notFound('Short link not found');
  }

  const result = await resolveShortCode(req.params.shortCode);

  res.set('Cache-Control', 'no-store');

  if (result.status === 'expired') {
    return res.redirect(302, `${env.clientUrl}/link-unavailable?reason=expired`);
  }
  if (result.status === 'inactive') {
    return res.redirect(302, `${env.clientUrl}/link-unavailable?reason=inactive`);
  }

  void recordClick({
    urlId: result.urlId,
    userId: result.userId,
    shortCode: req.params.shortCode,
    maxClicks: result.maxClicks,
    clickClaimed: result.clickClaimed,
    ip: getClientIp(req),
    userAgent: req.get('user-agent'),
    referrer: req.get('referer') ?? req.get('referrer') ?? undefined,
  });

  return res.redirect(302, result.originalUrl);
});
