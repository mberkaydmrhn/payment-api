// src/routes/payment.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); 
const Payment = require('../models/Payment');

// Servisler
const IyzicoService = require('../services/iyzico');
const StripeService = require('../services/stripe');

// GÜVENLİK KİLİDİ
const apiKeyAuth = require('../middleware/apiKeyAuth');

// Webhook Tetikleme Yardımcısı
async function triggerWebhook(url, data) {
    if (!url) return;
    try {
        console.log(`🔔 Webhook Gönderiliyor -> ${url}`);
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(err => console.error('❌ Webhook Gönderim Hatası:', err.message));
    } catch (error) {
        console.error('❌ Webhook Genel Hata:', error);
    }
}

// ============================================================
// 🔒 PRIVATE ROUTES (API Key Gerektirir)
// ============================================================

// 1. Ödeme Oluştur
router.post('/create', apiKeyAuth, async (req, res) => {
    try {
        // 'currency' bilgisini body'den alıyoruz (Varsayılan: TRY)
        const { amount, currency = 'TRY', description, customerInfo, webhookUrl, returnUrl, provider = 'mock' } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: { message: 'Geçersiz tutar' } });
        }

        const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        
        const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        let paymentUrl = '';
        let providerData = '';

        // --- IYZICO ---
        if (provider === 'iyzico') {
            console.log(`🔵 Iyzico Başlatılıyor (${amount} ${currency})...`);
            try {
                const iyzicoResult = await IyzicoService.initializePayment({
                    paymentId,
                    amount,
                    currency, // Iyzico'ya iletiyoruz (Genelde TRY çalışır)
                    description: description || 'Genel Ödeme',
                    customerInfo: customerInfo || { name: 'Misafir', email: 'guest@example.com' },
                    ip: req.ip,
                    baseUrl
                });

                if (iyzicoResult.status !== 'success') {
                    throw new Error(iyzicoResult.errorMessage || 'Iyzico başlatılamadı');
                }
                providerData = iyzicoResult.checkoutFormContent;
                paymentUrl = `${baseUrl}/api/payments/render/${paymentId}`; 
            } catch (err) {
                console.error('Iyzico Hatası:', err);
                return res.status(500).json({ success: false, error: { message: 'Iyzico Hatası: ' + err.message } });
            }
        } 
        // --- STRIPE ---
        else if (provider === 'stripe') {
            console.log(`🟢 Stripe Başlatılıyor (${amount} ${currency})...`);
            try {
                const session = await StripeService.createCheckoutSession({
                    paymentId,
                    amount,
                    currency, // 🔥 ÖNEMLİ: Seçilen para birimini servise gönderdik
                    description: description || 'Stripe Ödemesi',
                    customerInfo: customerInfo || { name: 'Misafir', email: 'guest@example.com' },
                    baseUrl
                });

                paymentUrl = session.url; 
                providerData = session.id;
            } catch (err) {
                console.error('Stripe Hatası:', err);
                return res.status(500).json({ success: false, error: { message: 'Stripe Hatası: ' + err.message } });
            }
        }
        // --- MOCK ---
        else {
            paymentUrl = `${baseUrl}/pay/${paymentId}`;
        }

        // DB KAYIT
        const newPayment = await Payment.create({
            paymentId,
            amount,
            currency, // DB'ye de doğru para birimini kaydedelim
            description,
            customerInfo,
            webhookUrl,
            returnUrl,
            status: 'pending',
            provider,
            providerData
        });

        console.log(`✅ Yeni Ödeme: ${paymentId} (${provider}) - ${amount} ${currency}`);

        res.status(201).json({
            success: true,
            data: {
                paymentId: newPayment.paymentId,
                paymentUrl,
                status: newPayment.status
            }
        });

    } catch (error) {
        console.error('Create Error:', error);
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});

// 2. Geçmiş İşlemleri Listele
router.get('/', apiKeyAuth, async (req, res) => {
    try {
        const list = await Payment.find().sort({ createdAt: -1 }).limit(50);
        res.json({ success: true, data: list });
    } catch (error) {
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
        
        res.json({
            success: true,
            data: {
                paymentId: payment.paymentId,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                provider: payment.provider
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Sorgu hatası' } });
    }
});

// 4. Iyzico Render
router.get('/render/:id', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment || !payment.providerData) return res.send('<h2>Hata: Ödeme formu bulunamadı.</h2>');
        if (payment.status === 'paid') return res.send('<h2>Bu ödeme zaten tamamlanmış.</h2>');

        const html = `
            <!DOCTYPE html>
            <html>
            <head><title>Güvenli Ödeme</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body><div id="iyzipay-checkout-form" class="responsive"></div>${payment.providerData}</body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send('Render hatası');
    }
});

// 5. Iyzico Callback
router.post('/iyzico/callback', async (req, res) => {
    try {
        const token = req.body.token;
        if (!token) return res.redirect('/demo?status=failed');
        const result = await IyzicoService.retrievePaymentResult(token);
        const paymentId = result.basketId; 
        const payment = await Payment.findOne({ paymentId: paymentId });
        if (!payment) return res.redirect('/demo?status=failed');

        if (result.paymentStatus === 'SUCCESS') {
            payment.status = 'paid';
            if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: 'paid', amount: payment.amount, currency: payment.currency, provider: 'iyzico' });
        } else {
            payment.status = 'failed';
        }
        await payment.save();
        const redirectUrl = payment.returnUrl || '/demo';
        res.redirect(`${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}status=${payment.status === 'paid' ? 'success' : 'failed'}`);
    } catch (error) {
        console.error('Iyzico Callback Error:', error);
        res.redirect('/demo?status=failed');
    }
});

// 6. Stripe Callback
router.get('/stripe/callback', async (req, res) => {
    const { session_id, cancel } = req.query;
    if (!session_id) return res.redirect('/demo?status=failed');

    try {
        const session = await StripeService.retrieveSession(session_id);
        const paymentId = session.metadata.paymentId;
        const payment = await Payment.findOne({ paymentId });

        if (!payment) return res.redirect('/demo?status=failed');

        if (cancel === 'true') {
             payment.status = 'failed';
             await payment.save();
             return res.redirect('/demo?status=failed');
        }

        if (session.payment_status === 'paid') {
            payment.status = 'paid';
            if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: 'paid', amount: payment.amount, currency: payment.currency, provider: 'stripe' });
        }
        await payment.save();
        const redirectUrl = payment.returnUrl || '/demo';
        res.redirect(`${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}status=${payment.status === 'paid' ? 'success' : 'failed'}`);

    } catch (error) {
        console.error('Stripe Callback Error:', error);
        res.redirect('/demo?status=failed');
    }
});

// 7. Mock Complete
router.post('/:id/complete', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment) return res.status(404).json({ success: false, message: 'Bulunamadı' });
        payment.status = req.body.success ? 'paid' : 'failed';
        await payment.save();
        if (payment.webhookUrl) triggerWebhook(payment.webhookUrl, { event: 'payment.completed', paymentId: payment.paymentId, status: payment.status, amount: payment.amount, currency: payment.currency, provider: 'mock' });
        res.json({ success: true, returnUrl: payment.returnUrl || '/' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;