import { Router } from 'express';
import * as urlController from '../controllers/url.controller';
import {
  shortenUrlValidator,
  updateUrlValidator,
  urlIdValidator,
} from '../validators/url.validator';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/authenticate';
import { shortenLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authenticate);

router.get('/', urlController.list);
router.post('/', shortenLimiter, shortenUrlValidator, validate, urlController.shorten);
router.get('/:id', urlIdValidator, validate, urlController.getOne);
router.patch('/:id', updateUrlValidator, validate, urlController.update);
router.delete('/:id', urlIdValidator, validate, urlController.remove);

export default router;
