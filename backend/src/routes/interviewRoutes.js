import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { activity, create, finish, getOne, list, liveToken, report, saveTranscript, summary } from '../controllers/interviewController.js';
import { requireAuth } from '../middleware/auth.js';

// Each live token costs voice minutes, so cap how often one signed-in user can ask for one.
const tokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.userId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many interview starts this hour. Please try again later.' },
  validate: { keyGeneratorIpFallback: false },
});

const router = Router();
router.use(requireAuth);
router.get('/summary', summary);
router.get('/activity', activity);
router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.post('/:id/live-token', tokenLimiter, liveToken);
router.put('/:id/transcript', saveTranscript);
router.post('/:id/finish', finish);
router.post('/:id/report', report);

export default router;
