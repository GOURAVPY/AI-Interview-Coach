import { Router } from 'express';
import { summary } from '../controllers/interviewController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', summary);

export default router;
