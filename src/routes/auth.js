// src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter'); // YENİ LIMITER

// 1. KAYIT OL
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Bu email zaten kayıtlı.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const apiKey = 'pm_live_' + uuidv4().replace(/-/g, '');

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
                apiKey: newUser.apiKey
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. GİRİŞ YAP
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Hatalı şifre.' });
        }

        res.json({
            success: true,
            message: 'Giriş başarılı',
            data: {
                email: user.email,
                apiKey: user.apiKey
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;