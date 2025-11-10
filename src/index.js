const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Middleware'leri import et
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const securityHeaders = require('./middleware/securityHeaders');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware'ler
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ DOSYA İSMİNİ KONTROL EDİN - payment.js mi payments.js mi?
app.use('/api/payments', require('./routes/payment'));

// Static files (public klasörü için)
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Ana endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '✅ Payment API çalışıyor!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      create_payment: 'POST /api/payments/create',
      check_status: 'GET /api/payments/:id/status',
      health: 'GET /health'
    }
  });
});

// HTML sayfası için route
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler (en sonda)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint bulunamadı'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Payment API: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Demo sayfası: http://localhost:${PORT}/demo`);
});