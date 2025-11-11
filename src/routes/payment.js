// src/routes/payment.js - IYZICO VERITABANI GUNCELLEME FIX
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const Payment = require('../models/Payment');
const IyzicoService = require('../services/iyzico');

// Webhook Yardımcısı
async function triggerWebhook(url, data) {
  if (!url) return;
  try {
    console.log(`🔔 Webhook tetikleniyor: ${url}`);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => console.error('❌ Webhook hatası:', err.message));
  } catch (error) {
    console.error('❌ Webhook genel hata:', error);
  }
}

// 1. Ödeme Oluştur
router.post('/create', async (req, res) => {
  try {
    const { amount, currency = 'TRY', description, customerInfo, webhookUrl, returnUrl, provider = 'mock' } = req.body;

    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: { message: 'Geçersiz tutar' } });

    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    let paymentUrl = '';
    let providerData = '';

    if (provider === 'iyzico') {
        console.log('🔵 Iyzico başlatılıyor...');
        try {
            const iyzicoResult = await IyzicoService.initializePayment({
                paymentId,
                amount,
                description: description || 'Genel Ödeme',
                customerInfo,
                ip: req.ip,
                baseUrl
            });

            if (iyzicoResult.status !== 'success') {
                throw new Error(iyzicoResult.errorMessage);
            }
            providerData = iyzicoResult.checkoutFormContent;
            paymentUrl = `${baseUrl}/api/payments/render/${paymentId}`;
        } catch (err) {
            console.error('Iyzico Hatası:', err);
            return res.status(500).json({ success: false, error: { message: 'Iyzico hatası: ' + err.message } });
        }
    } else {
        paymentUrl = `${baseUrl}/pay/${paymentId}`;
    }

    const newPayment = await Payment.create({
      paymentId,
      amount,
      currency,
      description,
      customerInfo,
      webhookUrl,
      returnUrl,
      status: 'pending', // İlk başta hep BEKLİYOR
      provider,
      providerData
    });

    console.log(`✅ Ödeme oluşturuldu (${provider}): ${paymentId}`);

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

// 2. Iyzico Render
router.get('/render/:id', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.id });
        if (!payment || !payment.providerData) return res.send('Ödeme formu bulunamadı.');

        const html = `
            <!DOCTYPE html>
            <html>
            <head><title>Güvenli Ödeme</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body><div id="iyzipay-checkout-form" class="responsive"></div>${payment.providerData}</body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.send('Hata oluştu.');
    }
});

// 3. IYZICO CALLBACK (GÜNCELLENDİ - VERİTABANI YAZMA)
router.post('/iyzico/callback', async (req, res) => {
    try {
        const token = req.body.token;
        console.log('🔄 Iyzico dönüş yaptı, token:', token);

        // 1. Iyzico'ya sor: Bu işlem ne oldu?
        const result = await IyzicoService.retrievePaymentResult(token);

        // 2. Bizim veritabanındaki ödemeyi bul (conversationId = paymentId)
        // Iyzico'dan dönen basketId bizim paymentId'mizdir.
        const paymentId = result.basketId; 
        const payment = await Payment.findOne({ paymentId: paymentId });

        if (!payment) {
            console.error('❌ Kritik Hata: Iyzico dönüş yaptı ama ödeme DBde yok:', paymentId);
            return res.redirect('/demo?status=failed');
        }

        // 3. Durumu Güncelle
        if (result.paymentStatus === 'SUCCESS') {
            console.log(`✅ Iyzico Ödemesi Başarılı: ${paymentId}`);
            payment.status = 'paid';
            
            // Webhook Tetikle
            if (payment.webhookUrl) {
                triggerWebhook(payment.webhookUrl, {
                    event: 'payment.completed',
                    paymentId: payment.paymentId,
                    status: 'paid',
                    amount: payment.amount
                });
            }
        } else {
            console.log(`❌ Iyzico Ödemesi Başarısız: ${paymentId}`);
            payment.status = 'failed';
        }

        // 4. Kaydet ve Yönlendir
        await payment.save();
        res.redirect(`/demo?status=${payment.status === 'paid' ? 'success' : 'failed'}`);

    } catch (error) {
        console.error('Callback Error:', error);
        res.redirect('/demo?status=failed');
    }
});

// 4. Mock Tamamla
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

// 5. Status
router.get('/:id/status', async (req, res) => {
  const payment = await Payment.findOne({ paymentId: req.params.id });
  if (!payment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
  res.json({
    success: true,
    data: {
      paymentId: payment.paymentId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      createdAt: payment.createdAt
    }
  });
});

// 6. Liste
router.get('/', async (req, res) => {
    const list = await Payment.find().sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: list });
});

module.exports = router;