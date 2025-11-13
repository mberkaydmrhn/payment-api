// src/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const hpp = require('hpp'); // YENİ
const xss = require('xss-clean'); // YENİ
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const securityHeaders = require('./middleware/securityHeaders');
const { generalLimiter } = require('./middleware/rateLimiter');

// DB Bağlantısı
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// --- GÜVENLİK ---
app.use(securityHeaders); // Helmet
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
}));
app.use(generalLimiter);
app.use(express.json({ limit: '10kb' })); // Body Limit
app.use(express.urlencoded({ extended: true }));

app.use(xss()); // XSS Temizleme
app.use(hpp()); // Parametre Kirliliği Önleme

// --- STATİK ---
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '0', etag: false }));

// --- LOG ---
app.use((req, res, next) => {
    // console.log(`📍 ${req.method} ${req.path}`); // Opsiyonel, logger.js yeterli
    next();
});

// --- ROTALAR ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payment'));

app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/pay/:id', (req, res) => res.sendFile(path.join(__dirname, '../public/checkout.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PayMint API Güvenli Modda Çalışıyor: http://localhost:${PORT}`);
});