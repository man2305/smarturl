import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db';
import { UserModel } from '../src/models/User.model';

// Mock the code generator so a collision can be forced deterministically.
vi.mock('../src/utils/base62', () => ({
  generateShortCode: vi.fn(),
}));

import { generateShortCode } from '../src/utils/base62';
import { urlService } from '../src/services/url.service';

const mockedGenerate = vi.mocked(generateShortCode);

describe('urlService.shorten random-code retry', () => {
  let userId: string;

  beforeAll(async () => {
    await startTestDb('retry');
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    vi.resetAllMocks();
    const user = await UserModel.create({
      name: 'Retry User',
      email: 'retry@example.com',
      password: 'password123',
    });
    userId = user.id;
  });

  it('retries with a fresh code when the generated code collides', async () => {
    await urlService.shorten({
      userId,
      originalUrl: 'https://example.com/first',
      customAlias: 'taken01',
    });

    mockedGenerate.mockReturnValueOnce('taken01').mockReturnValueOnce('fresh01');
    const created = await urlService.shorten({
      userId,
      originalUrl: 'https://example.com/second',
    });
    expect(created.shortCode).toBe('fresh01');
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });

  it('gives up with a 500 after exhausting retries', async () => {
    await urlService.shorten({
      userId,
      originalUrl: 'https://example.com/first',
      customAlias: 'taken01',
    });

    mockedGenerate.mockReturnValue('taken01');
    await expect(
      urlService.shorten({ userId, originalUrl: 'https://example.com/second' })
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(mockedGenerate).toHaveBeenCalledTimes(5);
  });
});
