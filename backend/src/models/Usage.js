import mongoose from 'mongoose';

// One counter per budget period, keyed by id:
//   user:<userId>:<YYYY-MM-DD>   voice seconds a user has reserved or used that day
//   global:<YYYY-MM>             voice seconds across all users that month
const usageSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seconds: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true },
);

export const Usage = mongoose.model('Usage', usageSchema);
