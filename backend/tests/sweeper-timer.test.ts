import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { urlRepository } from '../src/repositories/url.repository';
import { startExpirySweeper } from '../src/services/expirySweeper';

describe('expiry sweeper scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs immediately and then once an hour', async () => {
    const sweep = vi.spyOn(urlRepository, 'deactivateExpired').mockResolvedValue(3);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    startExpirySweeper();
    await vi.advanceTimersByTimeAsync(0);
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[sweeper] deactivated 3 expired link(s)');

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(sweep).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(sweep).toHaveBeenCalledTimes(3);
  });

  it('stays silent when nothing expired', async () => {
    vi.spyOn(urlRepository, 'deactivateExpired').mockResolvedValue(0);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    startExpirySweeper();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs and survives a failed sweep instead of crashing', async () => {
    const sweep = vi
      .spyOn(urlRepository, 'deactivateExpired')
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(0);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    startExpirySweeper();
    await vi.advanceTimersByTimeAsync(0);
    expect(error).toHaveBeenCalledWith('[sweeper] failed:', expect.any(Error));

    // The hourly schedule keeps running after the failure.
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(sweep).toHaveBeenCalledTimes(2);
  });
});
