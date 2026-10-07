import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ROLES } from '../config/options.js';
import { User } from '../models/User.js';
import { COOKIE_NAME } from '../middleware/auth.js';
import { claimDemoInterviews } from '../services/demo.js';

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetRole: z.union([z.enum(ROLES), z.literal('')]),
  targetCountry: z.string().trim().max(60),
});

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: SEVEN_DAYS,
  });
}

function firstIssue(parsed) {
  const issue = parsed.error.issues[0];
  return `${issue.path.join('.') || 'input'}: ${issue.message}`;
}

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  const { name, email, password } = parsed.data;
  if (await User.exists({ email })) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });
  await claimDemoInterviews(req, user._id);
  setSession(res, user.id);
  res.status(201).json({ user: user.toPublic() });
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  const { email, password } = parsed.data;
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

  await claimDemoInterviews(req, user._id);
  setSession(res, user.id);
  res.json({ user: user.toPublic() });
}

export function logout(_req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

export async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json({ user: user.toPublic() });
}

export async function updateProfile(req, res) {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  const user = await User.findByIdAndUpdate(req.userId, parsed.data, { new: true, runValidators: true });
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json({ user: user.toPublic() });
}
