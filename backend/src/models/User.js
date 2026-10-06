import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    targetRole: { type: String, default: '' },
    targetCountry: { type: String, default: '' },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    targetRole: this.targetRole,
    targetCountry: this.targetCountry,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
