// src/middleware/apiKeyAuth.js
const User = require('../models/User');

const apiKeyAuth = async (req, res, next) => {
  // Header'dan x-api-key'i al
  const apiKey = req.headers['x-api-key'];

  // DEMO İSTİSNASI: Eğer istek bizim Demo sayfasından geliyorsa (Origin kontrolü) veya
  // özel bir 'demo_key' kullanılıyorsa izin ver.
  // Şimdilik basit tutalım: Eğer API Key yoksa hata ver.
  
  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: { code: 'NO_API_KEY', message: 'API Anahtarı (x-api-key) eksik.' } 
    });
  }

  try {
    // Veritabanında bu anahtara sahip kullanıcı var mı?
    const user = await User.findOne({ apiKey });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: { code: 'INVALID_API_KEY', message: 'Geçersiz API Anahtarı.' } 
      });
    }

    // Kullanıcıyı request'e ekle (Route'larda kullanabiliriz)
    req.user = user;
    
    // Kullanım sayısını artır (Analytics için)
    user.usage += 1;
    await user.save();

    next(); // Devam et
  } catch (error) {
    res.status(500).json({ success: false, message: 'Auth Error' });
  }
};

module.exports = apiKeyAuth;