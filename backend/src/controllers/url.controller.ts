import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { urlService } from '../services/url.service';

export const shorten = asyncHandler(async (req: Request, res: Response) => {
  const url = await urlService.shorten({ ...req.body, userId: req.user!.id });
  sendSuccess(res, url, { message: 'Short link created', statusCode: 201 });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await urlService.list(req.user!.id, {
    page: req.query.page as never,
    limit: req.query.limit as never,
    search: req.query.search as string | undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    status: req.query.status as 'all' | 'active' | 'expired' | undefined,
  });
  sendSuccess(res, result.items, { meta: result.meta });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const url = await urlService.get(req.user!.id, req.params.id);
  sendSuccess(res, url);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const url = await urlService.update(req.user!.id, req.params.id, req.body);
  sendSuccess(res, url, { message: 'Short link updated' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await urlService.remove(req.user!.id, req.params.id);
  sendSuccess(res, null, { message: 'Short link deleted', statusCode: 200 });
});
