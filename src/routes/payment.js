const express = require('express');
const router = express.Router();

router.post('/create', async (req, res) => {
  try {
    const { amount, user_email, description } = req.body;
    
    if (!amount || !user_email) {
      return res.status(400).json({
        error: 'Amount ve user_email zorunlu'
      });
    }

    const response = {
      status: 'success',
      payment_url: 'https://sandbox-api.iyzipay.com/payment/mock_' + Date.now(),
      payment_id: 'mock_' + Date.now(),
      amount: amount,
      user_email: user_email,
      description: description || 'Ödeme işlemi'
    };

    console.log('✅ Ödeme oluşturuldu:', response);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Ödeme hatası:', error);
    res.status(500).json({ error: 'İç sunucu hatası' });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    const paymentId = req.params.id;
    
    const statusResponse = {
      payment_id: paymentId,
      status: 'success',
      amount: 100.00,
      paid_at: new Date().toISOString()
    };

    res.json(statusResponse);
    
  } catch (error) {
    res.status(500).json({ error: 'Status sorgulama hatası' });
  }
});

module.exports = router;
