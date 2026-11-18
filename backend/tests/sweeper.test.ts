import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import { UrlModel } from '../src/models/Url.model';
import { urlRepository } from '../src/repositories/url.repository';

/**
 * Regression test for the sweeper bug: deactivateExpired used to match
 * every link with expiresAt null (in $expr, null sorts below any date),
 * so the hourly sweep deactivated all permanent links on every run.
 */
describe('deactivateExpired (expiry sweeper)', () => {
  beforeAll(async () => {
    await startTestDb('sweeper');
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('deactivates only expired or budget-exhausted links', async () => {
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const mk = (shortCode: string, over: Record<string, unknown>) =>
      UrlModel.create({
        originalUrl: 'https://example.com',
        shortCode,
        isCustom: false,
        userId,
        clicks: 0,
        uniqueVisitors: 0,
        isActive: true,
        expiresAt: null,
        maxClicks: null,
        ...over,
      });

    await mk('perm001', {});
    await mk('exprd01', { expiresAt: new Date(now.getTime() - 60_000) });
    await mk('futr001', { expiresAt: new Date(now.getTime() + 3_600_000) });
    await mk('clicks1', { maxClicks: 5, clicks: 5 });
    await mk('clicks2', { maxClicks: 5, clicks: 2 });
    await mk('inactive', { expiresAt: new Date(now.getTime() - 60_000), isActive: false });

    const affected = await urlRepository.deactivateExpired(now);
    expect(affected).toBe(2);

    const states = new Map(
      (await UrlModel.find({}).select('shortCode isActive').lean().exec()).map((d) => [
        d.shortCode,
        d.isActive,
      ])
    );
    expect(states.get('perm001')).toBe(true);
    expect(states.get('exprd01')).toBe(false);
    expect(states.get('futr001')).toBe(true);
    expect(states.get('clicks1')).toBe(false);
    expect(states.get('clicks2')).toBe(true);
  });
});
