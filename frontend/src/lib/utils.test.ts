import { describe, it, expect } from 'vitest';
import { cn, formatNumber, truncateMiddle } from './utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind utilities to the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('formatNumber', () => {
  it('formats small numbers in full', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(9999)).toBe('9,999');
  });

  it('compacts large numbers', () => {
    expect(formatNumber(10000)).toBe('10K');
    expect(formatNumber(12400)).toBe('12K');
    expect(formatNumber(1500000)).toBe('1.5M');
  });
});

describe('truncateMiddle', () => {
  it('leaves short strings untouched', () => {
    expect(truncateMiddle('short')).toBe('short');
    expect(truncateMiddle('abcdefghij', 10)).toBe('abcdefghij');
  });

  it('truncates the middle with an ellipsis', () => {
    expect(truncateMiddle('abcdefghijk', 10)).toBe('abc...ijk');
    const long = 'https://example.com/very/long/path/to/a/resource';
    const out = truncateMiddle(long, 20);
    expect(out).toContain('...');
    expect(out.startsWith('https://')).toBe(true);
    expect(out.endsWith('resource')).toBe(true);
  });
});
