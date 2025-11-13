// src/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// DB Bağlantısını çağır
const connectDB = require('./config/db');

// Middleware'leri import et
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const securityHeaders = require('./middleware/securityHeaders');

// DİKKAT: apiKeyAuth'ı burada import etmene gerek yok, routes dosyasında kullanıyoruz.
// const apiKeyAuth = require('./middleware/apiKeyAuth'); <--- BU SATIRI SİL VEYA YORUMA AL

// Veritabanına Bağlan
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== AYARLAR ====================

app.use(securityHeaders);

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);

// ==================== STATİK DOSYALAR ====================

app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '0',
    etag: false
}));

// ==================== LOGLAMA ====================

app.use((req, res, next) => {
    console.log(`📍 [${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    next();
});

// ==================== ROTALAR ====================

// 1. Auth (Kayıt/Giriş)
app.use('/api/auth', require('./routes/auth'));

// 2. Payment API
// KRİTİK NOKTA BURASI: Burada 'apiKeyAuth' YOK! 
// Sadece require('./routes/payment') var.
app.use('/api/payments', require('./routes/payment'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Checkout Sayfaları
app.get('/pay/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// Ana sayfa
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PayMint API Çalışıyor: http://localhost:${PORT}`);
});