import mongoose from 'mongoose';
import { z } from 'zod';
import { LEVELS, ROLES } from '../config/options.js';
import { CodingSession } from '../models/CodingSession.js';
import { ProblemGenerationError, generateProblem, giveHint, reviewCode } from '../services/codingAi.js';
import { geminiConfigured } from '../services/gemini.js';

const MAX_CODE = 20000;
const MAX_HINTS = 3;

const createSchema = z.object({ role: z.enum(ROLES), level: z.enum(LEVELS) });
const codeSchema = z.object({ code: z.string().max(MAX_CODE) });
const submitSchema = z.object({
  code: z.string().min(1).max(MAX_CODE),
  passed: z.number().int().min(0).max(20),
  total: z.number().int().min(1).max(20),
  failures: z.array(z.string().max(300)).max(5).default([]),
});

function toPublic(s) {
  return {
    id: s._id.toString(),
    role: s.role,
    level: s.level,
    status: s.status,
    problem: s.problem,
    hints: s.hints ?? [],
    code: s.code,
    passed: s.passed,
    total: s.total,
    review: s.review ?? null,
    createdAt: s.createdAt,
  };
}

async function findOwned(req, select = '') {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return CodingSession.findOne({ _id: req.params.id, user: req.userId }).select(select);
}

const notFound = (res) => res.status(404).json({ error: 'Coding session not found' });

export async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Pick a role and a level' });
  if (!geminiConfigured()) return res.status(503).json({ error: 'The AI is not configured on the server' });

  const recent = await CodingSession.find({ user: req.userId }).sort({ createdAt: -1 }).limit(6).select('problem.title').lean();

  let generated;
  try {
    generated = await generateProblem({ ...parsed.data, avoidTitles: recent.map((r) => r.problem?.title).filter(Boolean) });
  } catch (err) {
    if (err instanceof ProblemGenerationError) {
      return res.status(502).json({ error: 'The AI could not prepare a good problem this time. Please try again.' });
    }
    throw err;
  }

  const session = await CodingSession.create({
    user: req.userId,
    ...parsed.data,
    problem: generated.problem,
    referenceSolution: generated.referenceSolution,
    code: generated.problem.starterCode,
  });
  res.status(201).json({ session: toPublic(session) });
}

export async function list(req, res) {
  const docs = await CodingSession.find({ user: req.userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('role level status problem.title passed total review.score createdAt')
    .lean();

  res.json({
    sessions: docs.map((d) => ({
      id: d._id.toString(),
      title: d.problem?.title ?? 'Coding problem',
      role: d.role,
      level: d.level,
      status: d.status,
      passed: d.passed,
      total: d.total,
      score: d.review?.score ?? null,
      createdAt: d.createdAt,
    })),
  });
}

export async function getOne(req, res) {
  const session = await findOwned(req);
  if (!session) return notFound(res);
  res.json({ session: toPublic(session) });
}

export async function saveCode(req, res) {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid code' });

  const session = await findOwned(req);
  if (!session) return notFound(res);
  if (session.status !== 'in_progress') return res.status(409).json({ error: 'This round is already submitted' });

  session.code = parsed.data.code;
  await session.save();
  res.json({ ok: true });
}

export async function hint(req, res) {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid code' });

  const session = await findOwned(req);
  if (!session) return notFound(res);
  if (session.status !== 'in_progress') return res.status(409).json({ error: 'This round is already submitted' });
  if (session.hints.length >= MAX_HINTS) return res.status(409).json({ error: `You have used all ${MAX_HINTS} hints.` });

  const result = await giveHint({
    problem: session.problem,
    code: parsed.data.code,
    level: session.hints.length + 1,
    previousHints: session.hints.map((h) => h.text),
  });

  session.hints.push(result);
  session.code = parsed.data.code;
  await session.save();
  res.json({ hint: result, hints: session.hints, hintsLeft: MAX_HINTS - session.hints.length });
}

export async function submit(req, res) {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid submission' });
  if (parsed.data.passed > parsed.data.total) return res.status(400).json({ error: 'Invalid test results' });

  const session = await findOwned(req);
  if (!session) return notFound(res);
  if (session.status === 'submitted') return res.json({ session: toPublic(session) });

  let review;
  try {
    review = await reviewCode({ problem: session.problem, ...parsed.data });
  } catch (err) {
    console.error('Code review failed:', err);
    return res.status(502).json({ error: 'The review failed. Please try submitting again.' });
  }

  session.status = 'submitted';
  session.code = parsed.data.code;
  session.passed = parsed.data.passed;
  session.total = parsed.data.total;
  session.review = review;
  session.submittedAt = new Date();
  await session.save();
  res.json({ session: toPublic(session) });
}
