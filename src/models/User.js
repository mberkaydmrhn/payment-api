// src/models/User.js
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
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro'],
    default: 'free'
  },
  usage: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);