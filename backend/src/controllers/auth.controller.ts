import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { authService } from '../services/auth.service';
import { REFRESH_TOKEN_COOKIE } from '../config/constants';
import { env } from '../config/env';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: env.jwt.refreshTtlMs,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/api/auth',
  });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  setRefreshCookie(res, result.tokens.refreshToken);
  sendSuccess(
    res,
    { user: result.user, accessToken: result.tokens.accessToken },
    { message: 'Account created successfully', statusCode: 201 }
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  setRefreshCookie(res, result.tokens.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.tokens.accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string | undefined>)[REFRESH_TOKEN_COOKIE];
  const result = await authService.refresh(token ?? '');
  setRefreshCookie(res, result.tokens.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.tokens.accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string | undefined>)[REFRESH_TOKEN_COOKIE];
  await authService.logout(token ?? '');
  clearRefreshCookie(res);
  sendSuccess(res, null, { message: 'Logged out successfully' });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  sendSuccess(res, user);
});
