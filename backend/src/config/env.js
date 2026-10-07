const required = ['MONGODB_URI', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live',
  geminiScoringModel: process.env.GEMINI_SCORING_MODEL || 'gemini-3.6-flash',
  isProd: process.env.NODE_ENV === 'production',
  // Live voice is billed by the minute, so it is capped per user per day and across all users per month.
  userDailyVoiceSec: Math.round(positive(process.env.USER_DAILY_VOICE_MINUTES, 30) * 60),
  // Demo visitors (no account): lifetime seconds each, and a daily total per network.
  demoSecondsPerVisitor: Math.round(positive(process.env.DEMO_SECONDS_PER_VISITOR, 180)),
  demoIpDailySec: Math.round(positive(process.env.DEMO_NETWORK_DAILY_SECONDS, 600)),
  trustProxy: process.env.TRUST_PROXY || '',
  globalMonthlyVoiceSec: Math.round(positive(process.env.GLOBAL_MONTHLY_VOICE_MINUTES, 600) * 60),
};
