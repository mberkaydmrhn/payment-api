// scripts/resetDb.js
const mongoose = require('mongoose');
require('dotenv').config(); // .env dosyasını okuması için

const Payment = require('../src/models/Payment'); // Model yolunu kontrol et

const reset = async () => {
    try {
        console.log("⏳ Veritabanına bağlanılıyor...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Bağlantı başarılı.");

        console.log("🗑️ Eski ödemeler siliniyor...");
        const result = await Payment.deleteMany({});
        
        console.log(`🎉 Temizlik Tamamlandı! Silinen kayıt sayısı: ${result.deletedCount}`);
        console.log("🚀 Artık sunucuyu 'npm run dev' ile tekrar başlatabilirsin.");
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Hata:", error);
        process.exit(1);
    }
};

reset();