import type { Response } from 'express';

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/**
 * Standard success envelope:
 * { success: true, message?, data, meta? }
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  options?: { message?: string; meta?: ResponseMeta; statusCode?: number }
): Response {
  return res.status(options?.statusCode ?? 200).json({
    success: true,
    message: options?.message,
    data,
    meta: options?.meta,
  });
}
