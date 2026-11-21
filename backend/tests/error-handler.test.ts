import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../src/middlewares/errorHandler';

function mockRes(headersSent: boolean) {
  return {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

const mockReq = { method: 'GET', originalUrl: '/x' } as Request;

describe('errorHandler', () => {
  it('delegates to Express when headers were already sent', () => {
    const res = mockRes(true);
    const next = vi.fn() as unknown as NextFunction;
    const err = new Error('too late');
    errorHandler(err, mockReq, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('maps an oversize payload to 413, not 500', () => {
    const res = mockRes(false);
    const next = vi.fn() as unknown as NextFunction;
    const err = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
    });
    errorHandler(err, mockReq, res, next);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Payload too large' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
