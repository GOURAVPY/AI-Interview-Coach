import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, me, register, updateProfile } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const router = Router();
router.post('/register', limiter, register);
router.post('/login', limiter, login);
router.post('/logout', logout);
router.get('/me', me);
router.patch('/profile', requireAuth, updateProfile);

export default router;
