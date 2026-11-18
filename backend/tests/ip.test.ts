import { describe, it, expect } from 'vitest';
import { getClientIp } from '../src/utils/ip';
import type { Request } from 'express';

function mockReq(
  ip: string | undefined,
  headers: Record<string, string> = {},
  socketIp = ''
): Request {
  return { ip, headers, socket: { remoteAddress: socketIp } } as unknown as Request;
}

describe('getClientIp', () => {
  it('uses req.ip and ignores a spoofed X-Forwarded-For', () => {
    const req = mockReq('203.0.113.7', { 'x-forwarded-for': '1.2.3.4, 203.0.113.7' });
    expect(getClientIp(req)).toBe('203.0.113.7');
  });

  it('returns req.ip when no proxy headers exist', () => {
    expect(getClientIp(mockReq('192.0.2.1'))).toBe('192.0.2.1');
    expect(getClientIp(mockReq('::1'))).toBe('::1');
  });

  it('falls back to the socket address when req.ip is missing', () => {
    expect(getClientIp(mockReq(undefined, {}, '198.51.100.9'))).toBe('198.51.100.9');
  });

  it('rejects garbage instead of storing it', () => {
    expect(getClientIp(mockReq('not-an-ip'))).toBe('');
    expect(getClientIp(mockReq(undefined))).toBe('');
  });
});
