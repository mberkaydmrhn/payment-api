// src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

// 1. KAYIT OL (Register)
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Email kontrolü
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Bu email zaten kayıtlı.' });
    }

    // Şifreleme (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // API Key Üretimi (pm_live_...)
    const apiKey = 'pm_live_' + uuidv4().replace(/-/g, '');

    // Kullanıcıyı Kaydet
    const newUser = await User.create({
      email,
      password: hashedPassword,
      apiKey
    });

    res.status(201).json({
      success: true,
      message: 'Kayıt başarılı!',
      data: {
        email: newUser.email,
        apiKey: newUser.apiKey // Kullanıcıya anahtarını veriyoruz
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GİRİŞ YAP (Login)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kullanıcı var mı?
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    // Şifre doğru mu?
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Hatalı şifre.' });
    }

    res.json({
      success: true,
      message: 'Giriş başarılı',
      data: {
        email: user.email,
        apiKey: user.apiKey // Giriş yapınca anahtarını tekrar göster
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;