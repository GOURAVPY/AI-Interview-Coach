import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUsage } from '../services/usage.js';

const router = Router();
router.get('/', requireAuth, async (req, res) => {
  res.json(await getUsage(req.userId));
});

export default router;
