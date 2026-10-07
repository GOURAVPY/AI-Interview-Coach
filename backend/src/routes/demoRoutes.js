import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createDemo, demoStatus, finish, getOne, liveToken, report, saveTranscript } from '../controllers/interviewController.js';
import { visitor } from '../middleware/visitor.js';

const perVisitor = (limit, windowMs, message) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => req.owner.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    validate: { keyGeneratorIpFallback: false },
  });

// Everything under /api/demo works without an account. Visitors are told apart by a cookie.
const router = Router();
router.use(visitor);

router.get('/status', demoStatus);
router.post('/interviews', perVisitor(10, 60 * 60 * 1000, 'Too many demo interviews. Create an account to keep practising.'), createDemo);
router.get('/interviews/:id', getOne);
router.post('/interviews/:id/live-token', perVisitor(6, 60 * 60 * 1000, 'Too many connection attempts. Please try again later.'), liveToken);
router.put('/interviews/:id/transcript', saveTranscript);
router.post('/interviews/:id/finish', finish);
router.post('/interviews/:id/report', perVisitor(6, 60 * 60 * 1000, 'Too many reports requested. Please try again later.'), report);

export default router;
