import mongoose from 'mongoose';

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    language: { type: String, default: 'English' },
    jobPost: { type: String, default: '' },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    durationSec: { type: Number, default: 0 },
    overallScore: { type: Number, min: 0, max: 100, default: null },
    endedAt: { type: Date, default: null },
    tokensIssued: { type: Number, default: 0 },
    transcript: {
      type: [
        {
          _id: false,
          speaker: { type: String, enum: ['interviewer', 'candidate'], required: true },
          text: { type: String, required: true, maxlength: 4000 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

interviewSchema.index({ user: 1, createdAt: -1 });

export const Interview = mongoose.model('Interview', interviewSchema);
