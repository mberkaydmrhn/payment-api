// src/models/Payment.js
const mongoose = require('mongoose');
const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;
require('dotenv').config();

const PaymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'TRY' },
    description: String,
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    
    // Bu alanlar veritabanında şifreli saklanacak
    customerInfo: { 
        name: String, 
        email: String 
    },
    
    webhookUrl: String,
    returnUrl: String,
    provider: { type: String, default: 'mock' },
    providerData: String
}, { timestamps: true });

// Şifreleme Eklentisi
PaymentSchema.plugin(mongooseFieldEncryption, { 
    fields: ["customerInfo"], 
    secret: process.env.ENCRYPTION_KEY || "bu_key_mutlaka_env_dosyasinda_tanimli_olmali_32_char" 
});

module.exports = mongoose.model('Payment', PaymentSchema);