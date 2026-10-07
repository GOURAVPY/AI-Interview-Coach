import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { create, getOne, hint, list, saveCode, submit } from '../controllers/codingController.js';
import { requireAuth } from '../middleware/auth.js';

const perUser = (limit, windowMs, message) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => req.userId,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    validate: { keyGeneratorIpFallback: false },
  });

const router = Router();
router.use(requireAuth);

router.get('/sessions', list);
router.post('/sessions', perUser(15, 24 * 60 * 60 * 1000, 'You have started enough coding rounds for today. Try again tomorrow.'), create);
router.get('/sessions/:id', getOne);
router.put('/sessions/:id/code', saveCode);
router.post('/sessions/:id/hint', perUser(40, 60 * 60 * 1000, 'Too many hint requests. Please wait a bit.'), hint);
router.post('/sessions/:id/submit', perUser(30, 60 * 60 * 1000, 'Too many submissions. Please wait a bit.'), submit);

export default router;
