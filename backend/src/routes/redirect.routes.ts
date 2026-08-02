import { Router } from 'express';
import * as redirectController from '../controllers/redirect.controller';

const router = Router();

// Matches top-level single-segment paths: GET /<shortCode>
router.get('/:shortCode', redirectController.redirect);

export default router;
