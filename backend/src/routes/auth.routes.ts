import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { registerValidator, loginValidator } from '../validators/auth.validator';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/authenticate';
import { loginLimiter, refreshLimiter, registerLimiter } from '../middlewares/rateLimiter';
import { requireSameOrigin } from '../middlewares/requireSameOrigin';

const router = Router();

router.post('/register', requireSameOrigin, registerLimiter, registerValidator, validate, authController.register);
router.post('/login', requireSameOrigin, loginLimiter, loginValidator, validate, authController.login);
router.post('/refresh', requireSameOrigin, refreshLimiter, authController.refresh);
router.post('/logout', requireSameOrigin, refreshLimiter, authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
