import { Router } from 'express';
import * as redirectController from '../controllers/redirect.controller';
import { redirectLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.get('/:shortCode', redirectLimiter, redirectController.redirect);

export default router;
