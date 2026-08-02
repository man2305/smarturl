import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { urlStatsValidator } from '../validators/analytics.validator';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.get('/overview', analyticsController.overview);
router.get('/urls/:id', urlStatsValidator, validate, analyticsController.urlStats);

export default router;
