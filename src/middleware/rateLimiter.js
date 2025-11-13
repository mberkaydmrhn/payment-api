// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// 1. Genel API Limiti
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderdiniz.' } }
});

// 2. Ödeme Oluşturma Limiti (Fraud koruması)
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, // IP başına 15 dk'da max 20 ödeme
    message: { success: false, error: { code: 'FRAUD_PROTECTION', message: 'Kısa sürede çok fazla ödeme denemesi yaptınız.' } }
});

// 3. Auth Limiti (Brute Force)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 10, 
    message: { success: false, error: { code: 'AUTH_LIMIT', message: 'Çok fazla giriş denemesi. 1 saat engellendiniz.' } }
});

module.exports = { generalLimiter, paymentLimiter, authLimiter };