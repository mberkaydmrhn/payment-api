const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  apiKey: { 
    type: String, 
    unique: true 
  },
  // --- YENİ ALANLAR ---
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  usage: {
    type: Number,
    default: 0
  },
  usageLimit: {
    type: Number,
    default: 10 // Ücretsiz plan limiti
  },
  lastResetDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);