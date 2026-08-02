import { Router, type Request, type Response } from 'express';
import authRoutes from './auth.routes';
import urlRoutes from './url.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/urls', urlRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
