import mongoose from 'mongoose';

const interviewSchema = new mongoose.Schema(
  {
    // Demo interviews belong to a visitor cookie until that visitor signs up.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    visitor: { type: String, index: true },
    demo: { type: Boolean, default: false },
    role: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    language: { type: String, default: 'English' },
    jobPost: { type: String, default: '' },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    durationSec: { type: Number, default: 0 },
    overallScore: { type: Number, min: 0, max: 100, default: null },
    endedAt: { type: Date, default: null },
    speechMs: { type: Number, default: 0 },
    tokensIssued: { type: Number, default: 0 },
    // Voice time reserved when the last token was issued, and when. Settled against the server clock on finish.
    reservedSec: { type: Number, default: 0 },
    tokenIssuedAt: { type: Date, default: null },
    usageKeys: { type: [String], default: [] },
    usageSettled: { type: Boolean, default: true },
    transcript: {
      type: [
        {
          _id: false,
          speaker: { type: String, enum: ['interviewer', 'candidate'], required: true },
          text: { type: String, required: true, maxlength: 4000 },
          durationMs: { type: Number, min: 0, default: 0 },
        },
      ],
      default: [],
    },
    report: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

interviewSchema.index({ user: 1, createdAt: -1 });

export const Interview = mongoose.model('Interview', interviewSchema);
