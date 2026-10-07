import { env } from '../config/env.js';
import { Usage } from '../models/Usage.js';

export const MAX_SESSION_SEC = 600;
export const MIN_SESSION_SEC = 60;
// Extra time added to a session token so a clean finish is never cut off mid-sentence.
export const TOKEN_GRACE_SEC = 45;

export class UsageLimitError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const pad = (n) => String(n).padStart(2, '0');

export function periodKeys(date = new Date()) {
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return { day, month: day.slice(0, 7) };
}

const userId = (uid, day) => `user:${uid}:${day}`;
const globalId = (month) => `global:${month}`;

async function used(id) {
  const doc = await Usage.findById(id).lean();
  return doc?.seconds ?? 0;
}

// Adds `seconds` only if the counter stays within `limit`. Safe under concurrent requests.
async function addWithinLimit(id, seconds, limit) {
  await Usage.updateOne({ _id: id }, { $setOnInsert: { seconds: 0 } }, { upsert: true });
  const res = await Usage.updateOne({ _id: id, seconds: { $lte: limit - seconds } }, { $inc: { seconds } });
  return res.modifiedCount === 1;
}

async function subtract(id, seconds) {
  if (seconds > 0) await Usage.updateOne({ _id: id }, { $inc: { seconds: -seconds } });
}

export async function getUsage(uid) {
  const { day, month } = periodKeys();
  const [userUsed, globalUsed] = await Promise.all([used(userId(uid, day)), used(globalId(month))]);
  return {
    dailyLimitSec: env.userDailyVoiceSec,
    dailyUsedSec: Math.min(userUsed, env.userDailyVoiceSec),
    dailyRemainingSec: Math.max(0, env.userDailyVoiceSec - userUsed),
    serviceAvailable: globalUsed + MIN_SESSION_SEC <= env.globalMonthlyVoiceSec,
  };
}

// Reserves voice time before a session starts. Returns how many seconds the session may last.
export async function reserveVoiceTime(uid) {
  const { day, month } = periodKeys();
  const [userUsed, globalUsed] = await Promise.all([used(userId(uid, day)), used(globalId(month))]);

  const userLeft = env.userDailyVoiceSec - userUsed;
  const globalLeft = env.globalMonthlyVoiceSec - globalUsed;

  if (globalLeft < MIN_SESSION_SEC) {
    throw new UsageLimitError('global_monthly', 'Voice interviews are paused for this month because the free limit has been reached. Please come back next month.');
  }
  if (userLeft < MIN_SESSION_SEC) {
    throw new UsageLimitError('user_daily', "You've used today's free voice time. It resets at midnight UTC, so please come back tomorrow.");
  }

  const seconds = Math.floor(Math.min(MAX_SESSION_SEC, userLeft, globalLeft));

  if (!(await addWithinLimit(userId(uid, day), seconds, env.userDailyVoiceSec))) {
    throw new UsageLimitError('user_daily', 'You are starting interviews too quickly. Please wait a moment and try again.');
  }
  if (!(await addWithinLimit(globalId(month), seconds, env.globalMonthlyVoiceSec))) {
    await subtract(userId(uid, day), seconds);
    throw new UsageLimitError('global_monthly', 'Voice interviews are paused for this month because the free limit has been reached.');
  }

  return { seconds, day, month };
}

// Gives back the part of a reservation that was not used. `usedSec` comes from the server's clock.
export async function refundUnused(uid, reserved, usedSec) {
  const unused = Math.max(0, reserved.seconds - Math.min(reserved.seconds, Math.ceil(usedSec)));
  if (unused === 0) return 0;
  await Promise.all([subtract(userId(uid, reserved.day), unused), subtract(globalId(reserved.month), unused)]);
  return unused;
}
