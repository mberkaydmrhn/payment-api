const express = require('express');
const router = express.Router();

// Örnek ödeme verileri (gerçek uygulamada database kullanın)
const payment = new Map();

// Ödeme oluştur
router.post('/create', (req, res) => {
  try {
    const { amount, currency = 'TRY', description, customerInfo } = req.body;

    // Validasyon
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Geçersiz tutar'
        }
      });
    }

    // Ödeme ID oluştur
    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Ödeme verisi
    const paymentData = {
      id: paymentId,
      amount,
      currency,
      description,
      customerInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Ödemeyi kaydet
    payment.set(paymentId, paymentData);

    console.log(`✅ Ödeme oluşturuldu: ${paymentId}`);

    res.status(201).json({
      success: true,
      data: {
        paymentId,
        status: 'pending',
        createdAt: paymentData.createdAt
      }
    });

  } catch (error) {
    console.error('Ödeme oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_CREATION_FAILED',
        message: 'Ödeme oluşturulamadı'
      }
    });
  }
});

// Ödeme durumu sorgula
router.get('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const payment = payment.get(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Ödeme bulunamadı'
        }
      });
    }

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }
    });

  } catch (error) {
    console.error('Ödeme sorgulama hatası:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_QUERY_FAILED',
        message: 'Ödeme durumu sorgulanamadı'
      }
    });
  }
});

// Ödeme listesi (admin için)
router.get('/', (req, res) => {
  try {
    const paymentList = Array.from(payment.values()).map(payment => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt
    }));

    res.json({
      success: true,
      data: {
        payment: paymentList,
        total: paymentList.length
      }
    });

  } catch (error) {
    console.error('Ödeme listeleme hatası:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_LIST_FAILED',
        message: 'Ödemeler listelenemedi'
      }
    });
  }
});

module.exports = router;