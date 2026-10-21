import mongoose from 'mongoose';

const routePointSchema = new mongoose.Schema({
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  recordedAt: { type: Date, required: true },
  elapsedSeconds: { type: Number, required: true, min: 0 },
  distanceMeters: { type: Number, required: true, min: 0 },
  breakBefore: { type: Boolean, default: false }
}, { _id: false });

const runSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, maxlength: 80, default: '' },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  durationSeconds: { type: Number, required: true, min: 0 },
  distanceMeters: { type: Number, required: true, min: 0 },
  route: { type: [routePointSchema], default: [] }
}, { timestamps: true });

runSchema.index({ userId: 1, startedAt: -1 });

export default mongoose.model('Run', runSchema);
