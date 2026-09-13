const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String }, // Kosong jika login via OAuth
  authProvider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  providerId: { type: String },
  apiKey: { type: String, unique: true, required: true },
  plan: { type: String, enum: ['free', 'premium', 'vip'], default: 'free' },
  limit: { type: Number, default: 50 }, // 50 request untuk free
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
