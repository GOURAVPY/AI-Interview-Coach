import mongoose from 'mongoose';

const codingSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    level: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    problem: { type: mongoose.Schema.Types.Mixed, required: true },
    // The AI's own solution. Kept on the server and never sent to the browser until the candidate submits.
    referenceSolution: { type: String, select: false },
    hints: { type: [{ _id: false, text: String, line: Number }], default: [] },
    code: { type: String, default: '' },
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    review: { type: mongoose.Schema.Types.Mixed, default: null },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

codingSessionSchema.index({ user: 1, createdAt: -1 });

export const CodingSession = mongoose.model('CodingSession', codingSessionSchema);
