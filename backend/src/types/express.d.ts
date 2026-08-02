import 'express';

/**
 * Global augmentation of the Express Request type so `req.user`
 * is strongly typed across the codebase after authentication.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

export {};
