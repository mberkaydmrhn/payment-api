const mongoose = require('mongoose');
const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;
require('dotenv').config();

const PaymentSchema = new mongoose.Schema({
    // 🔥 YENİ: Ödemeyi oluşturan kullanıcıyı buraya bağlıyoruz
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true 
    },
    
    paymentId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'TRY' },
    description: String,
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    
    customerInfo: { name: String, email: String },
    webhookUrl: String,
    returnUrl: String,
    provider: { type: String, default: 'mock' },
    providerData: String
}, { timestamps: true });

PaymentSchema.plugin(mongooseFieldEncryption, { 
    fields: ["customerInfo"], 
    secret: process.env.ENCRYPTION_KEY || "varsayilan_guvensiz_key_lutfen_env_ekle" 
});

module.exports = mongoose.model('Payment', PaymentSchema);