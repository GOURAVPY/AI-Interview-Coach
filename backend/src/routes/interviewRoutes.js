import { Router } from 'express';
import { activity, create, finish, getOne, list, liveToken, report, saveTranscript, summary } from '../controllers/interviewController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', summary);
router.get('/activity', activity);
router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.post('/:id/live-token', liveToken);
router.put('/:id/transcript', saveTranscript);
router.post('/:id/finish', finish);
router.post('/:id/report', report);

export default router;
