const express = require('express');
const cors = require('cors');
const path = require('path');
const hpp = require('hpp');
const xss = require('xss-clean');
const swaggerUi = require('swagger-ui-express'); // Swagger UI
const swaggerSpecs = require('./config/swagger'); // Swagger Config
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const securityHeaders = require('./middleware/securityHeaders');
const { generalLimiter } = require('./middleware/rateLimiter');

// DB Bağlantısı
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// --- GÜVENLİK KATMANLARI ---

// 1. Helmet (HTTP Başlık Güvenliği)
app.use(securityHeaders);

// 2. CORS (Hangi sitelerin erişebileceği)
app.use(cors({
    origin: "*", // Canlıda burayı kendi domainin yap
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
}));

// 3. Rate Limiting (DDoS Koruması)
app.use(generalLimiter);

// 4. SWAGGER DOKÜMANTASYONU (YENİ)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }', // Üst barı gizle
    customSiteTitle: "PayMint API Docs"
}));

// 5. Body Parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 6. Veri Temizleme
app.use(xss());
app.use(hpp());

// --- STATİK DOSYALAR ---
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '0',
    etag: false
}));

// --- LOGLAMA ---
app.use((req, res, next) => {
    console.log(`📍 [${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    next();
});

// --- ROTALAR ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payment'));

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});

// UI Rotaları
app.get('/pay/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Hata Yönetimi
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PayMint API Güvenli Modda Çalışıyor: http://localhost:${PORT}`);
    console.log(`📚 API Dokümantasyonu: http://localhost:${PORT}/api-docs`);
});