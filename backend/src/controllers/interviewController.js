import mongoose from 'mongoose';
import { Interview } from '../models/Interview.js';

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
