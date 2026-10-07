import mongoose from 'mongoose';
import { z } from 'zod';
import { LANGUAGES, LEVELS, ROLES } from '../config/options.js';
import { Interview } from '../models/Interview.js';

const createSchema = z.object({
  role: z.enum(ROLES),
  level: z.enum(LEVELS),
  language: z.enum(LANGUAGES),
  jobPost: z.string().trim().max(6000).optional().default(''),
});

function toPublic(i) {
  return {
    id: i._id.toString(),
    role: i.role,
    level: i.level,
    language: i.language,
    jobPost: i.jobPost,
    status: i.status,
    overallScore: i.overallScore,
    durationSec: i.durationSec,
    createdAt: i.createdAt,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date) {
  return Math.floor(date.getTime() / DAY_MS);
}

// Consecutive practice days ending today or yesterday.
function currentStreak(dates) {
  const days = new Set(dates.map((d) => dayKey(d)));
  let cursor = dayKey(new Date());
  if (!days.has(cursor)) cursor -= 1;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

export async function summary(req, res) {
  const userId = new mongoose.Types.ObjectId(req.userId);

  const [completed, recent] = await Promise.all([
    Interview.find({ user: userId, status: 'completed' }).select('overallScore durationSec endedAt createdAt').lean(),
    Interview.find({ user: userId }).sort({ createdAt: -1 }).limit(5).select('role level language status overallScore durationSec createdAt').lean(),
  ]);

  const scored = completed.filter((i) => typeof i.overallScore === 'number');
  const averageScore = scored.length ? Math.round(scored.reduce((sum, i) => sum + i.overallScore, 0) / scored.length) : null;
  const practiceMinutes = Math.round(completed.reduce((sum, i) => sum + i.durationSec, 0) / 60);

  res.json({
    stats: {
      interviews: completed.length,
      averageScore,
      practiceMinutes,
      streakDays: currentStreak(completed.map((i) => i.endedAt ?? i.createdAt)),
    },
    recent: recent.map((i) => ({
      id: i._id.toString(),
      role: i.role,
      level: i.level,
      language: i.language,
      status: i.status,
      overallScore: i.overallScore,
      durationSec: i.durationSec,
      createdAt: i.createdAt,
    })),
  });
}

export async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: `${issue.path.join('.') || 'input'}: ${issue.message}` });
  }

  const interview = await Interview.create({ ...parsed.data, user: req.userId });
  res.status(201).json({ interview: toPublic(interview) });
}

export async function getOne(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Interview not found' });

  const interview = await Interview.findOne({ _id: req.params.id, user: req.userId });
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  res.json({ interview: toPublic(interview) });
}
