import { describe, it, expect } from 'vitest';
import { generateShortCode } from '../src/utils/base62';

describe('generateShortCode', () => {
  it('generates 7-char Base62 codes by default', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateShortCode()).toMatch(/^[0-9A-Za-z]{7}$/);
    }
  });

  it('honours a requested length', () => {
    expect(generateShortCode(10)).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(generateShortCode(3)).toMatch(/^[0-9A-Za-z]{3}$/);
  });

  it('generates unique codes across 10k samples', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      codes.add(generateShortCode());
    }
    expect(codes.size).toBe(10_000);
  });
});
