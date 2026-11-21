import type { NextFunction, Request, Response } from 'express';
import { validationResult, type ValidationError } from 'express-validator';
import { ApiError } from '../utils/ApiError';

export function validate(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map((error: ValidationError) => {
    if (error.type === 'field') {
      return { field: error.path, message: error.msg };
    }
    return { field: error.type, message: error.msg };
  });

  next(ApiError.badRequest('Validation failed', formatted));
}
