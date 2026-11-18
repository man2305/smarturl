import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes';
import urlRoutes from './url.routes';
import analyticsRoutes from './analytics.routes';
import { isRedisEnabled } from '../config/redis';

const router = Router();

// Readiness, not just liveness: MongoDB is required (a mid-run outage must
// fail the health check so the platform restarts the container), while
// Redis is optional by design and reported for information only.
router.get('/health', (_req: Request, res: Response) => {
  const mongoOk = mongoose.connection.readyState === 1;
  res.status(mongoOk ? 200 : 503).json({
    status: mongoOk ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      mongo: mongoOk ? 'connected' : 'disconnected',
      redis: isRedisEnabled() ? 'connected' : 'disabled',
    },
  });
});

router.use('/auth', authRoutes);
router.use('/urls', urlRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
