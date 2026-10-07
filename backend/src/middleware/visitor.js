import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const VISITOR_COOKIE = 'vid';
const YEAR = 365 * 24 * 60 * 60 * 1000;

// Gives every demo visitor a random id in a cookie, so their demo time can be limited without an account.
export function visitor(req, res, next) {
  let id = req.cookies?.[VISITOR_COOKIE];
  if (!/^[a-f0-9]{32}$/.test(id ?? '')) {
    id = crypto.randomBytes(16).toString('hex');
    res.cookie(VISITOR_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: YEAR });
  }

  const ip = (req.ip ?? 'unknown').replace(/^::ffff:/, '');
  req.owner = { kind: 'visitor', id, ip };
  next();
}
