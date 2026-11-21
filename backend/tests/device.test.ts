import { describe, it, expect } from 'vitest';
import { parseUserAgent } from '../src/utils/device';

describe('parseUserAgent', () => {
  it('parses a desktop Chrome UA', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('Windows');
    expect(result.device).toBe('desktop');
  });

  it('parses a mobile iPhone UA', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    );
    expect(result.browser).toBe('Mobile Safari');
    expect(result.device).toBe('mobile');
    expect(result.deviceName).toBe('iPhone');
  });

  it('normalises exotic device classes to other', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (PlayStation 4 3.11) AppleWebKit/537.73 (KHTML, like Gecko)'
    );
    expect(result.device).toBe('other');
  });

  it('degrades safely on a missing UA', () => {
    expect(parseUserAgent(undefined)).toEqual({
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      device: 'desktop',
      deviceName: '',
    });
  });
});
