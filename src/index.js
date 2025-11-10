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

// ==================== MIDDLEWARE KONFİGÜRASYONU ====================

// Security headers
app.use(securityHeaders);

// CORS - SADECE BİR KEZ KULLAN!
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// ==================== STATIC FILE SERVING ====================

// Static files - SADECE BİR KEZ KULLAN!
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// ==================== REQUEST LOGGING ====================

app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==================== ROUTES ====================

// API Routes
app.use('/api/payments', require('./routes/payment'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Ana endpoint - JSON response
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '✅ Payment API çalışıyor!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      create_payment: 'POST /api/payments/create',
      check_status: 'GET /api/payments/:id/status',
      health: 'GET /health',
      demo: 'GET /demo'
    }
  });
});

// Demo sayfası için route
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Root route - index.html göster
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==================== ERROR HANDLING ====================

// 404 handler - API routelar için
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint bulunamadı'
    }
  });
});

// 404 handler - static files için
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler (en sonda)
app.use(errorHandler);

// ==================== SERVER BAŞLATMA ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Payment API: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Demo sayfası: http://localhost:${PORT}`);
  console.log(`📁 Static files: ${path.join(__dirname, '../public')}`);
});