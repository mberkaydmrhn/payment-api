const User = require('../models/User');

const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ success: false, error: { code: 'NO_API_KEY', message: 'API Anahtarı (x-api-key) eksik.' } });
  }

  try {
    const user = await User.findOne({ apiKey });

    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_API_KEY', message: 'Geçersiz API Anahtarı.' } });
    }

    // --- KOTA SIFIRLAMA ---
    const now = new Date();
    const lastReset = user.lastResetDate ? new Date(user.lastResetDate) : new Date();
    const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);
    
    if (daysSinceReset >= 30) {
        user.usage = 0;
        user.lastResetDate = now;
        await user.save();
    }

    // --- KOTA KONTROLÜ (SADECE BAK, DOKUNMA) ---
    if (req.path.includes('/create')) {
        const limit = user.usageLimit || 10; // Varsayılan limit
        if (user.usage >= limit) {
            return res.status(402).json({
                success: false,
                error: { 
                    code: 'QUOTA_EXCEEDED', 
                    message: `Aylık işlem limitiniz (${limit}) doldu. Lütfen paketinizi yükseltin.` 
                }
            });
        }
        // 🔥 BURADAKİ 'user.usage += 1' SATIRINI SİLDİK! 🔥
    }

    req.user = user; // User'ı request'e ekle ki route içinde kullanabilelim
    next();

  } catch (error) {
    console.error("Auth Middleware Hatası:", error);
    res.status(500).json({ success: false, message: 'Auth Error' });
  }
};

module.exports = apiKeyAuth;