// src/routes/payment.js - MongoDB Versiyonu
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const Payment = require('../models/Payment'); // Modeli çağırdık

// Webhook Yardımcısı
async function triggerWebhook(url, data) {
  if (!url) return;
  try {
    console.log(`🔔 Webhook tetikleniyor: ${url}`);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => console.error('❌ Webhook gönderim hatası:', err.message));
  } catch (error) {
    console.error('❌ Webhook genel hata:', error);
  }
}

// 1. Ödeme Oluştur
router.post('/create', async (req, res) => {
  try {
    const { amount, currency = 'TRY', description, customerInfo, webhookUrl, returnUrl } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Geçersiz tutar' } });
    }

    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const protocol = req.protocol;
    const host = req.get('host');
    const paymentUrl = `${protocol}://${host}/pay/${paymentId}`;

    // MongoDB'ye kaydet
    const newPayment = await Payment.create({
      paymentId,
      amount,
      currency,
      description,
      customerInfo,
      webhookUrl,
      returnUrl,
      status: 'pending'
    });

    console.log(`✅ Ödeme DB'ye yazıldı: ${paymentId}`);

    res.status(201).json({
      success: true,
      data: {
        paymentId: newPayment.paymentId,
        paymentUrl,
        status: newPayment.status
      }
    });

  } catch (error) {
    console.error('Ödeme oluşturma hatası:', error);
    res.status(500).json({ success: false, error: { code: 'ERROR', message: error.message } });
  }
});

// 2. Ödeme Tamamla
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { success } = req.body;

    // Veritabanında ID'ye göre bul
    const payment = await Payment.findOne({ paymentId: id });
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Ödeme bulunamadı' });
    }

    // Durumu güncelle
    payment.status = success ? 'paid' : 'failed';
    await payment.save(); // Değişikliği kaydet

    // Webhook Tetikle
    if (payment.webhookUrl) {
      triggerWebhook(payment.webhookUrl, {
        event: 'payment.completed',
        paymentId: payment.paymentId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency
      });
    }

    res.json({ 
      success: true, 
      returnUrl: payment.returnUrl || '/' 
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Durum Sorgula
router.get('/:id/status', async (req, res) => {
  try {
    // Veritabanından oku
    const payment = await Payment.findOne({ paymentId: req.params.id });
    
    if (!payment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ödeme bulunamadı' } });
    }
    
    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;