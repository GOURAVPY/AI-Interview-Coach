import { Router } from 'express';
import { create, getOne, summary } from '../controllers/interviewController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', summary);
router.post('/', create);
router.get('/:id', getOne);

export default router;
