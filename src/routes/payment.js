// src/routes/payment.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); // node-fetch v2
const Payment = require('../models/Payment');
const IyzicoService = require('../services/iyzico');

// GÜVENLİK KİLİDİ: Middleware'i buraya import ediyoruz
const apiKeyAuth = require('../middleware/apiKeyAuth');

// Webhook Tetikleme Yardımcısı
async function triggerWebhook(url, data) {
    if (!url) return;
    try {
        console.log(`🔔 Webhook Gönderiliyor -> ${url}`);
        // Fire-and-forget (Cevabı beklememize gerek yok ama logluyoruz)
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
// 🔒 PRIVATE ROUTES (API Key Gerektirir - Developer İşlemleri)
// ============================================================

// 1. Ödeme Oluştur (Sadece Yetkili Developer)
router.post('/create', apiKeyAuth, async (req, res) => {
    try {
        const { amount, currency = 'TRY', description, customerInfo, webhookUrl, returnUrl, provider = 'mock' } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: { message: 'Geçersiz tutar (0 veya negatif olamaz)' } });
        }

        // Benzersiz Payment ID oluştur
        const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        
        // Base URL tespiti
        const protocol = req.headers['x-forwarded-proto'] || req.protocol; // Proxy arkasında çalışırsa diye
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        let paymentUrl = '';
        let providerData = '';

        // Iyzico Entegrasyonu
        if (provider === 'iyzico') {
            console.log('🔵 Iyzico Başlatılıyor...');
            try {
                const iyzicoResult = await IyzicoService.initializePayment({
                    paymentId,
                    amount,
                    description: description || 'Genel Ödeme',
                    customerInfo: customerInfo || { name: 'Misafir', email: 'guest@example.com' },
                    ip: req.ip,
                    baseUrl
                });

                if (iyzicoResult.status !== 'success') {
                    throw new Error(iyzicoResult.errorMessage || 'Iyzico başlatılamadı');
                }
                providerData = iyzicoResult.checkoutFormContent; // HTML Form datası
                paymentUrl = `${baseUrl}/api/payments/render/${paymentId}`; // Özel render sayfası
            } catch (err) {
                console.error('Iyzico Hatası:', err);
                return res.status(500).json({ success: false, error: { message: 'Provider Hatası: ' + err.message } });
            }
        } else {
            // Mock (Simülasyon) Linki
            paymentUrl = `${baseUrl}/pay/${paymentId}`;
        }

        // DB Kayıt
        const newPayment = await Payment.create({
            paymentId,
            amount,
            currency,
            description,
            customerInfo,
            webhookUrl,
            returnUrl,
            status: 'pending',
            provider,
            providerData
        });

        console.log(`✅ Yeni Ödeme: ${paymentId} (${provider})`);

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

// 2. Geçmiş İşlemleri Listele (Sadece Yetkili Developer)
router.get('/', apiKeyAuth, async (req, res) => {
    try {
        // Sadece son 50 işlem
        const list = await Payment.find().sort({ createdAt: -1 }).limit(50);
        res.json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Liste alınamadı' } });
    }
});

// ============================================================
// 🌍 PUBLIC ROUTES (API Key GEREKTİRMEZ - Checkout/Callback)
// ============================================================

// 3. Ödeme Durumunu Sorgula (Checkout sayfası kullanır)
// Not: Güvenlik için normalde burası da kısıtlanabilir ama demo için açık bırakıyoruz.
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
                // Hassas verileri (müşteri email vb.) buraya eklemiyoruz
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Sorgu hatası' } });
    }
});

// 4. Iyzico Formunu Render Et (Tarayıcıda açılır)
router.get('/render/:id', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment || !payment.providerData) return res.send('<h2>Hata: Ödeme formu bulunamadı.</h2>');
        if (payment.status === 'paid') return res.send('<h2>Bu ödeme zaten tamamlanmış.</h2>');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Güvenli Ödeme</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8fafc;}</style>
            </head>
            <body>
                <div id="iyzipay-checkout-form" class="responsive"></div>
                ${payment.providerData}
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send('Render hatası');
    }
});

// 5. IYZICO CALLBACK (Iyzico Sunucusu Çağırır)
router.post('/iyzico/callback', async (req, res) => {
    try {
        const token = req.body.token;
        console.log('🔄 Iyzico Callback Geldi. Token:', token);

        if (!token) return res.redirect('/demo?status=failed');

        // Iyzico servisinden sonucu sorgula
        const result = await IyzicoService.retrievePaymentResult(token);
        
        // basketId bizim paymentId'mizdir
        const paymentId = result.basketId; 
        const payment = await Payment.findOne({ paymentId: paymentId });

        if (!payment) {
            console.error('❌ Callback Hatası: Ödeme veritabanında yok ->', paymentId);
            return res.redirect('/demo?status=failed');
        }

        // Durumu Güncelle
        if (result.paymentStatus === 'SUCCESS') {
            console.log(`✅ Ödeme Başarılı: ${paymentId}`);
            payment.status = 'paid';
            
            // Webhook
            if (payment.webhookUrl) {
                triggerWebhook(payment.webhookUrl, {
                    event: 'payment.completed',
                    paymentId: payment.paymentId,
                    status: 'paid',
                    amount: payment.amount,
                    currency: payment.currency
                });
            }
        } else {
            console.log(`❌ Ödeme Başarısız: ${paymentId}`);
            payment.status = 'failed';
        }

        await payment.save();

        // Kullanıcıyı geldiği yere geri gönder (veya demo sayfasına)
        // returnUrl varsa oraya, yoksa demoya
        const redirectUrl = payment.returnUrl || '/demo?status=' + payment.status;
        // URL parametresi ekle
        const finalUrl = redirectUrl.includes('?') 
            ? `${redirectUrl}&status=${payment.status === 'paid' ? 'success' : 'failed'}`
            : `${redirectUrl}?status=${payment.status === 'paid' ? 'success' : 'failed'}`;

        res.redirect(finalUrl);

    } catch (error) {
        console.error('Callback Error:', error);
        res.redirect('/demo?status=failed');
    }
});

// 6. Mock Tamamla (Simülasyon - Checkout Sayfası Çağırır)
router.post('/:id/complete', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment) return res.status(404).json({ success: false, message: 'Bulunamadı' });

        payment.status = req.body.success ? 'paid' : 'failed';
        await payment.save();

        if (payment.webhookUrl) {
            triggerWebhook(payment.webhookUrl, {
                event: 'payment.completed',
                paymentId: payment.paymentId,
                status: payment.status,
                amount: payment.amount
            });
        }

        res.json({ success: true, returnUrl: payment.returnUrl || '/' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;