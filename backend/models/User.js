import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  pictureUrl: { type: String, default: '', maxlength: 2048 }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
