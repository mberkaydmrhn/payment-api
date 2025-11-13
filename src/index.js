// src/index.js - AUTH SİSTEMLİ FİNAL
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
const apiKeyAuth = require('./middleware/apiKeyAuth'); // YENİ: Güvenlik kilidimiz

// Veritabanına Bağlan
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== AYARLAR ====================

app.use(securityHeaders);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"] // YENİ: x-api-key'e izin ver
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);

// ==================== STATİK DOSYALAR (CACHE KAPALI) ====================

app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '0',
  etag: false
}));

// ==================== LOGLAMA ====================

app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==================== ROTALAR ====================

// 1. Auth (Kayıt/Giriş) - HERKESE AÇIK
app.use('/api/auth', require('./routes/auth'));

// 2. Payment API - ARTIK KORUMALI!
// Bu rotaya gelen isteklerde "x-api-key" header'ı olmak zorunda.
app.use('/api/payments', apiKeyAuth, require('./routes/payment'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Demo sayfaları (Mock ve Iyzico Render)
app.get('/pay/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// Ana sayfa
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Payment API: http://localhost:${PORT}`);
});