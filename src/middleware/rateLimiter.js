const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // 15 dakikada maksimum 100 istek
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = rateLimiter;