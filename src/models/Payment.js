const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'TRY' },
  description: String,
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  customerInfo: { name: String, email: String },
  webhookUrl: String,
  returnUrl: String,
  
  // YENİ ALANLAR
  provider: { type: String, default: 'mock' }, // 'mock' veya 'iyzico'
  providerData: String // Iyzico HTML script'i burada saklanacak
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', PaymentSchema);