// src/models/Payment.js
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'TRY'
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  customerInfo: {
    name: String,
    email: String
  },
  webhookUrl: String,
  returnUrl: String
}, {
  timestamps: true // Oluşturulma ve güncellenme tarihlerini otomatik tutar
});

module.exports = mongoose.model('Payment', PaymentSchema);