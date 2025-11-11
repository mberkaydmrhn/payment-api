const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// YENİ: DB Bağlantısını çağır
const connectDB = require('./config/db');

// Middleware'leri import et
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const securityHeaders = require('./middleware/securityHeaders');

// YENİ: Veritabanına Bağlan
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== AYARLAR ====================

// Security headers (CSP Kapalı)
app.use(securityHeaders);

// CORS - Herkese izin ver
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// ==================== STATİK DOSYALAR (CACHE KAPALI) ====================

app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '0', // <--- KRİTİK AYAR: Önbelleği kapattık
  etag: false
}));

// ==================== LOGLAMA ====================

app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==================== ROTALAR ====================

app.use('/api/payments', require('./routes/payment'));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Demo sayfaları
app.get('/pay/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// Diğer her şey için index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Payment API: http://localhost:${PORT}`);
});