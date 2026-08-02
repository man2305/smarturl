import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getOverview, getUrlAnalytics } from '../services/analytics.service';

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const data = await getOverview(req.user!.id);
  sendSuccess(res, data);
});

export const urlStats = asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.query.days ?? 30);
  const data = await getUrlAnalytics(req.user!.id, req.params.id, days);
  sendSuccess(res, data);
});
