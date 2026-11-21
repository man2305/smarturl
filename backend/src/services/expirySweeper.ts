import { urlRepository } from '../repositories/url.repository';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Background job that deactivates links which have passed their expiry date
 * or click budget. This is a safety net — links are also deactivated eagerly
 * on the redirect hot path — so it keeps the DB consistent even for links
 * that are never visited again.
 */
export function startExpirySweeper(): void {
  const run = async () => {
    try {
      const affected = await urlRepository.deactivateExpired();
      if (affected > 0) {
        console.log(`[sweeper] deactivated ${affected} expired link(s)`);
      }
    } catch (err) {
      console.error('[sweeper] failed:', err);
    }
  };

  void run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref();
}
