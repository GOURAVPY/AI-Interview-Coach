import mongoose from 'mongoose';
import { z } from 'zod';
import { LANGUAGES, LEVELS, ROLES } from '../config/options.js';
import { Interview } from '../models/Interview.js';
import { createLiveToken, geminiConfigured } from '../services/gemini.js';
import { INTERVIEW_MINUTES } from '../prompts/interviewer.js';

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
    transcript: i.transcript ?? [],
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

const MAX_TOKENS_PER_INTERVIEW = 3;
const MAX_DURATION_SEC = INTERVIEW_MINUTES * 60 + 120;

const transcriptSchema = z.object({
  transcript: z
    .array(
      z.object({
        speaker: z.enum(['interviewer', 'candidate']),
        text: z.string().trim().min(1).max(4000),
      }),
    )
    .max(300),
});

const finishSchema = z.object({
  durationSec: z.number().int().min(0).max(MAX_DURATION_SEC),
});

async function findOwned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Interview.findOne({ _id: req.params.id, user: req.userId });
}

export async function liveToken(req, res) {
  if (!geminiConfigured()) return res.status(503).json({ error: 'Voice is not configured on the server' });

  const interview = await findOwned(req);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (interview.status !== 'in_progress') return res.status(409).json({ error: 'This interview is already finished' });
  if (interview.tokensIssued >= MAX_TOKENS_PER_INTERVIEW) {
    return res.status(429).json({ error: 'Too many connection attempts for this interview. Start a new one.' });
  }

  const result = await createLiveToken(interview);
  interview.tokensIssued += 1;
  await interview.save();

  res.json({ ...result, maxSeconds: INTERVIEW_MINUTES * 60 });
}

export async function saveTranscript(req, res) {
  const parsed = transcriptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid transcript' });

  const interview = await findOwned(req);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (interview.status !== 'in_progress') return res.status(409).json({ error: 'This interview is already finished' });

  interview.transcript = parsed.data.transcript;
  await interview.save();
  res.json({ ok: true, turns: interview.transcript.length });
}

export async function finish(req, res) {
  const parsed = finishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid duration' });

  const interview = await findOwned(req);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (interview.status === 'completed') return res.json({ interview: toPublic(interview) });

  interview.status = 'completed';
  interview.durationSec = parsed.data.durationSec;
  interview.endedAt = new Date();
  await interview.save();
  res.json({ interview: toPublic(interview) });
}
