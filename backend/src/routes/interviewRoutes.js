import { Router } from 'express';
import { create, finish, getOne, liveToken, saveTranscript, summary } from '../controllers/interviewController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', summary);
router.post('/', create);
router.get('/:id', getOne);
router.post('/:id/live-token', liveToken);
router.put('/:id/transcript', saveTranscript);
router.post('/:id/finish', finish);

export default router;
