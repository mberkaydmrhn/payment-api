const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const Payment = require('../models/Payment');
const User = require('../models/User'); // 🔥 User modelini ekle

// Servisler
const IyzicoService = require('../services/iyzico');
const StripeService = require('../services/stripe');
const { checkTransactionRisk } = require('../services/fraud');

// Middleware
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { validatePayment } = require('../middleware/validator');
const { paymentLimiter } = require('../middleware/rateLimiter');

// Utils
const { logInfo, logError, maskData } = require('../utils/logger');

// Webhook Helper
async function triggerWebhook(url, data) {
    if (!url) return;
    try {
        logInfo(`🔔 Webhook Gönderiliyor -> ${url}`);
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(err => logError('Webhook Gönderim Hatası', err.message));
    } catch (error) {
        logError('Webhook Genel Hata', error);
    }
}

// 🔥 YENİ HELPER: KOTA ARTIRMA FONKSİYONU 🔥
async function incrementUserUsage(userId) {
    try {
        const user = await User.findById(userId);
        if (user) {
            user.usage = (user.usage || 0) + 1;
            await user.save();
            logInfo(`📈 Kota Arttırıldı: ${user.email} (Yeni: ${user.usage})`);
        }
    } catch (error) {
        logError('Kota Artırma Hatası', error.message);
    }
}

// ============================================================
// 🔒 PRIVATE ROUTES
// ============================================================

/**
 * @swagger
 * /api/payments/create:
 *   post:
 *     summary: Yeni bir ödeme linki oluşturur
 *     tags: [Payments]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - customerInfo
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 150.50
 *               currency:
 *                 type: string
 *                 enum: [TRY, USD, EUR]
 *                 default: TRY
 *               provider:
 *                 type: string
 *                 enum: [iyzico, stripe, mock]
 *                 default: iyzico
 *               description:
 *                 type: string
 *                 example: "Premium Üyelik"
 *               customerInfo:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Ahmet Yılmaz"
 *                   email:
 *                     type: string
 *                     example: "ahmet@mail.com"
 *               webhookUrl:
 *                 type: string
 *                 description: "Ödeme başarılı olduğunda bu URL'e POST isteği atılır"
 *               returnUrl:
 *                 type: string
 *                 description: "Ödeme bitince kullanıcının döneceği sayfa"
 *     responses:
 *       201:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentId:
 *                       type: string
 *                       example: "pay_123456789"
 *                     paymentUrl:
 *                       type: string
 *                       example: "https://payment-api.onrender.com/pay/pay_123456789"
 *                     status:
 *                       type: string
 *                       example: "pending"
 *       400:
 *         description: Hatalı İstek (Validation Error)
 *       401:
 *         description: Yetkisiz (API Key Eksik)
 *       403:
 *         description: Güvenlik İhlali (Fraud)
 */
router.post('/create', apiKeyAuth, paymentLimiter, validatePayment, async (req, res) => {
    try {
        const { amount, currency, description, customerInfo, webhookUrl, returnUrl, provider } = req.body;

        // 1. FRAUD KONTROLÜ
        try {
            checkTransactionRisk({ amount, description, customerInfo });
        } catch (fraudError) {
            logError(`🚨 FRAUD ENGELİ: ${fraudError.message}`, { customer: customerInfo.email, amount });
            return res.status(403).json({
                success: false,
                error: { code: 'SECURITY_VIOLATION', message: fraudError.message }
            });
        }

        const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        let paymentUrl = '';
        let providerData = '';

        if (provider === 'iyzico') {
            logInfo(`🔵 Iyzico Başlatılıyor`, { amount, currency, customerInfo });
            try {
                const iyzicoResult = await IyzicoService.initializePayment({
                    paymentId, amount, currency, description, customerInfo, ip: req.ip, baseUrl
                });
                if (iyzicoResult.status !== 'success') throw new Error(iyzicoResult.errorMessage);
                providerData = iyzicoResult.checkoutFormContent;
                paymentUrl = `${baseUrl}/api/payments/render/${paymentId}`;
            } catch (err) {
                logError('Iyzico Hatası', err.message);
                return res.status(500).json({ success: false, error: { message: err.message } });
            }
        }
        else if (provider === 'stripe') {
            logInfo(`🟢 Stripe Başlatılıyor`, { amount, currency, customerInfo });
            try {
                const session = await StripeService.createCheckoutSession({
                    paymentId, amount, currency, description, customerInfo, baseUrl
                });
                paymentUrl = session.url;
                providerData = session.id;
            } catch (err) {
                logError('Stripe Hatası', err.message);
                return res.status(500).json({ success: false, error: { message: err.message } });
            }
        }
        else {
            paymentUrl = `${baseUrl}/pay/${paymentId}`;
        }

        const newPayment = await Payment.create({
            userId: req.user._id, // 🔥 YENİ: Kullanıcıyı ödemeye bağlıyoruz
            paymentId, amount, currency, description, customerInfo, webhookUrl, returnUrl,
            status: 'pending', provider, providerData
        });

        logInfo(`✅ Ödeme Oluşturuldu: ${paymentId} (${provider})`);

        res.status(201).json({
            success: true,
            data: { paymentId: newPayment.paymentId, paymentUrl, status: newPayment.status }
        });

    } catch (error) {
        logError('Create Error', error.message);
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Geçmiş ödemeleri listeler
 *     tags: [Payments]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Başarılı
 *       401:
 *         description: Yetkisiz
 */
router.get('/', apiKeyAuth, async (req, res) => {
    try {
        // Sadece bu kullanıcının ödemelerini getir (Security fix)
        const rawList = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
        const maskedList = rawList.map(p => maskData(p.toObject()));
        res.json({ success: true, data: maskedList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { message: 'Liste alınamadı' } });
    }
});

// ============================================================
// 🌍 PUBLIC ROUTES
// ============================================================

/**
 * @swagger
 * /api/payments/{id}/status:
 *   get:
 *     summary: Bir ödemenin durumunu sorgular (Public)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID (pay_...)
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "paid"
 *                     amount:
 *                       type: number
 *       404:
 *         description: Bulunamadı
 */
router.get('/:id/status', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });

        // Tekil veriyi de maskele
        const masked = maskData(payment.toObject());
        res.json({ success: true, data: { ...masked } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Sorgu hatası' } });
    }
});

// Render Iyzico Payment Form
router.get('/render/:id', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment || !payment.providerData) return res.send('<h2>Hata: Form bulunamadı.</h2>');
        if (payment.status === 'paid') return res.send('<h2>Bu ödeme zaten tamamlanmış.</h2>');
        res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="iyzipay-checkout-form" class="responsive"></div>${payment.providerData}</body></html>`);
    } catch (error) { 
        res.status(500).send('Render hatası'); 
    }
});

// Iyzico Callback
router.post('/iyzico/callback', async (req, res) => {
    try {
        const token = req.body.token;
        if (!token) return res.redirect('/demo?status=failed');
        const result = await IyzicoService.retrievePaymentResult(token);
        const payment = await Payment.findOne({ paymentId: result.basketId });
        if (!payment) return res.redirect('/demo?status=failed');

        if (result.paymentStatus === 'SUCCESS' && payment.status !== 'paid') {
            logInfo(`✅ Iyzico Ödeme Başarılı: ${payment.paymentId}`);
            payment.status = 'paid';
            await payment.save();
            
            // 🔥 KOTA ARTIRMA BURADA 🔥
            await incrementUserUsage(payment.userId);

            if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: 'paid' });
        } else if (payment.status !== 'paid') {
            payment.status = 'failed';
            await payment.save();
        }
        const redirectUrl = payment.returnUrl || '/demo';
        const separator = redirectUrl.includes('?') ? '&' : '?';
        res.redirect(`${redirectUrl}${separator}status=${payment.status === 'paid' ? 'success' : 'failed'}`);
    } catch (error) {
        logError('Iyzico Callback Error', error.message);
        res.redirect('/demo?status=failed');
    }
});

// Stripe Callback
router.get('/stripe/callback', async (req, res) => {
    const { session_id, cancel } = req.query;
    if (!session_id) return res.redirect('/demo?status=failed');
    try {
        const session = await StripeService.retrieveSession(session_id);
        const payment = await Payment.findOne({ paymentId: session.metadata.paymentId });
        if (!payment) return res.redirect('/demo?status=failed');

        if (cancel === 'true') {
             payment.status = 'failed';
             await payment.save();
             return res.redirect('/demo?status=failed');
        }
        if (session.payment_status === 'paid' && payment.status !== 'paid') {
            logInfo(`✅ Stripe Ödeme Başarılı: ${payment.paymentId}`);
            payment.status = 'paid';
            await payment.save();

            // 🔥 KOTA ARTIRMA BURADA 🔥
            await incrementUserUsage(payment.userId);

            if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: 'paid' });
        }
        await payment.save();
        const redirectUrl = payment.returnUrl || '/demo';
        const separator = redirectUrl.includes('?') ? '&' : '?';
        res.redirect(`${redirectUrl}${separator}status=${payment.status === 'paid' ? 'success' : 'failed'}`);
    } catch (error) {
        logError('Stripe Callback Error', error.message);
        res.redirect('/demo?status=failed');
    }
});

// Mock Complete
router.post('/:id/complete', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment) return res.status(404).json({ success: false });
        
        const isSuccess = req.body.success;
        payment.status = isSuccess ? 'paid' : 'failed';
        await payment.save();

        if (isSuccess && payment.status === 'paid') {
            // 🔥 KOTA ARTIRMA BURADA 🔥
            await incrementUserUsage(payment.userId);
        }

        if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: payment.status });
        res.json({ success: true, returnUrl: payment.returnUrl || '/' });
    } catch (e) { 
        res.status(500).json({ success: false }); 
    }
});

module.exports = router;