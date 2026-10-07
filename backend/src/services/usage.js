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

// Every limit that applies to someone, as counters. Counter ids look like:
//   user:<id>:<day>     a signed-in user's voice seconds today
//   visitor:<id>        a demo visitor's lifetime voice seconds
//   ip:<address>:<day>  all demo voice seconds from one network today
//   global:<month>      everyone's voice seconds this month
function buckets(owner) {
  const { day, month } = periodKeys();
  const list = [];

  if (owner.kind === 'user') {
    list.push({ id: `user:${owner.id}:${day}`, limit: env.userDailyVoiceSec, code: 'user_daily' });
  } else {
    list.push({ id: `visitor:${owner.id}`, limit: env.demoSecondsPerVisitor, code: 'demo_used' });
    list.push({ id: `ip:${owner.ip}:${day}`, limit: env.demoIpDailySec, code: 'demo_network' });
  }
  list.push({ id: `global:${month}`, limit: env.globalMonthlyVoiceSec, code: 'global_monthly' });
  return list;
}

const MESSAGES = {
  user_daily: "You've used today's free voice time. It resets at midnight UTC, so please come back tomorrow.",
  demo_used: "You've used your free demo. Create an account to keep practising.",
  demo_network: 'Too many demo interviews have been started from your network today. Create an account to continue, or try again tomorrow.',
  global_monthly: 'Voice interviews are paused for this month because the free limit has been reached. Please come back next month.',
};

async function usedSeconds(ids) {
  const docs = await Usage.find({ _id: { $in: ids } }).lean();
  const map = new Map(docs.map((d) => [d._id, d.seconds]));
  return ids.map((id) => map.get(id) ?? 0);
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

// What the Practice page shows a signed-in user.
export async function getUsage(owner) {
  const list = buckets(owner);
  const used = await usedSeconds(list.map((b) => b.id));
  const userBucket = list[0];
  const global = list[list.length - 1];

  return {
    dailyLimitSec: userBucket.limit,
    dailyUsedSec: Math.min(used[0], userBucket.limit),
    dailyRemainingSec: Math.max(0, userBucket.limit - used[0]),
    serviceAvailable: used[used.length - 1] + MIN_SESSION_SEC <= global.limit,
  };
}

// What the landing page shows a demo visitor: how long they can still talk.
export async function getDemoStatus(owner) {
  const list = buckets(owner);
  const used = await usedSeconds(list.map((b) => b.id));
  const left = Math.min(...list.map((b, i) => b.limit - used[i]));
  const blocked = list.find((b, i) => b.limit - used[i] < MIN_SESSION_SEC);

  return {
    totalSec: env.demoSecondsPerVisitor,
    remainingSec: Math.max(0, Math.min(left, env.demoSecondsPerVisitor)),
    available: !blocked,
    reason: blocked ? blocked.code : null,
    message: blocked ? MESSAGES[blocked.code] : null,
  };
}

// Reserves voice time before a session starts. Returns how many seconds the session may last
// and which counters were charged, so the unused part can be refunded later.
export async function reserveVoiceTime(owner) {
  const list = buckets(owner);
  const used = await usedSeconds(list.map((b) => b.id));

  const blocked = list.find((b, i) => b.limit - used[i] < MIN_SESSION_SEC);
  if (blocked) throw new UsageLimitError(blocked.code, MESSAGES[blocked.code]);

  const seconds = Math.floor(Math.min(MAX_SESSION_SEC, ...list.map((b, i) => b.limit - used[i])));

  const charged = [];
  for (const b of list) {
    if (!(await addWithinLimit(b.id, seconds, b.limit))) {
      await Promise.all(charged.map((id) => subtract(id, seconds)));
      throw new UsageLimitError(b.code, MESSAGES[b.code]);
    }
    charged.push(b.id);
  }

  return { seconds, keys: charged };
}

// Gives back the part of a reservation that was not used. `usedSec` comes from the server's clock.
export async function refundUnused(reserved, usedSec) {
  const unused = Math.max(0, reserved.seconds - Math.min(reserved.seconds, Math.ceil(usedSec)));
  if (unused === 0) return 0;
  await Promise.all(reserved.keys.map((id) => subtract(id, unused)));
  return unused;
}
