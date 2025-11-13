// src/routes/payment.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); 
const Payment = require('../models/Payment');

// Servisler
const IyzicoService = require('../services/iyzico');
const StripeService = require('../services/stripe');
const { checkTransactionRisk } = require('../services/fraud');

// Middleware
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { validatePayment } = require('../middleware/validator');
const { paymentLimiter } = require('../middleware/rateLimiter');

// Utils - 🔥 BURASI DÜZELTİLDİ (maskData eklendi)
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

// ============================================================
// 🔒 PRIVATE ROUTES
// ============================================================

// 1. Ödeme Oluştur
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
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
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

// 2. Liste (Privacy Masking)
router.get('/', apiKeyAuth, async (req, res) => {
    try {
        const rawList = await Payment.find().sort({ createdAt: -1 }).limit(50);
        // Maskeleme fonksiyonunu kullan
        const maskedList = rawList.map(p => maskData(p.toObject()));
        res.json({ success: true, data: maskedList });
    } catch (error) {
        // Hata detayını terminale bas ki görelim
        console.error(error);
        res.status(500).json({ success: false, error: { message: 'Liste alınamadı' } });
    }
});

// ============================================================
// 🌍 PUBLIC ROUTES
// ============================================================

// 3. Status
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

// 4. Render
router.get('/render/:id', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment || !payment.providerData) return res.send('<h2>Hata: Form bulunamadı.</h2>');
        if (payment.status === 'paid') return res.send('<h2>Ödeme zaten tamamlandı.</h2>');
        res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="iyzipay-checkout-form" class="responsive"></div>${payment.providerData}</body></html>`);
    } catch (error) { res.status(500).send('Render hatası'); }
});

// 5. Iyzico Callback
router.post('/iyzico/callback', async (req, res) => {
    try {
        const token = req.body.token;
        if (!token) return res.redirect('/demo?status=failed');
        const result = await IyzicoService.retrievePaymentResult(token);
        const payment = await Payment.findOne({ paymentId: result.basketId });
        if (!payment) return res.redirect('/demo?status=failed');

        if (result.paymentStatus === 'SUCCESS') {
            logInfo(`✅ Iyzico Ödeme Başarılı: ${payment.paymentId}`);
            payment.status = 'paid';
            if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: 'paid' });
        } else {
            payment.status = 'failed';
        }
        await payment.save();
        const redirectUrl = payment.returnUrl || '/demo';
        res.redirect(`${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}status=${payment.status === 'paid' ? 'success' : 'failed'}`);
    } catch (error) {
        logError('Iyzico Callback Error', error.message);
        res.redirect('/demo?status=failed');
    }
});

// 6. Stripe Callback
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
        if (session.payment_status === 'paid') {
            logInfo(`✅ Stripe Ödeme Başarılı: ${payment.paymentId}`);
            payment.status = 'paid';
            if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: 'paid' });
        }
        await payment.save();
        const redirectUrl = payment.returnUrl || '/demo';
        res.redirect(`${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}status=${payment.status === 'paid' ? 'success' : 'failed'}`);
    } catch (error) {
        logError('Stripe Callback Error', error.message);
        res.redirect('/demo?status=failed');
    }
});

// 7. Mock Complete
router.post('/:id/complete', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment) return res.status(404).json({ success: false });
        payment.status = req.body.success ? 'paid' : 'failed';
        await payment.save();
        if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: payment.status });
        res.json({ success: true, returnUrl: payment.returnUrl || '/' });
    } catch (e) { res.status(500).json({ success: false }); }
});

module.exports = router;