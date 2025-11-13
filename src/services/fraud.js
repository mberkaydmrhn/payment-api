// src/services/fraud.js

// 1. YASAKLI KELİME LİSTESİ
const BLACKLIST_KEYWORDS = [
    'bahis', 'iddaa', 'kumar', 'bet', 'casino', 'slot', 'rulet', 'poker', 'jackpot',
    'escort', 'adult', '+18', 'xxx', 'porn',
    'bitcoin', 'crypto', 'kripto', 'tether', 'usdt', 'ether',
    'forex', 'kaldıraç', 'hisse'
];

// 2. RİSK ANALİZİ FONKSİYONU
const checkTransactionRisk = (data) => {
    
    // A. KELİME FİLTRESİ
    const textToCheck = `${data.description} ${data.customerInfo.name} ${data.customerInfo.email}`.toLowerCase();
    
    const foundKeyword = BLACKLIST_KEYWORDS.find(word => textToCheck.includes(word));
    
    if (foundKeyword) {
        throw new Error(`GÜVENLİK İHLALİ: İşlem içeriğinde yasaklı kelime tespit edildi (${foundKeyword.toUpperCase()}). İşlem engellendi.`);
    }

    // B. TUTAR ANALİZİ (Structuring Şüphesi)
    // 10.000 TL üzeri ve 1000'e tam bölünen (yuvarlak) rakamlar şüpheli olabilir.
    if (data.amount >= 10000) {
        if (data.amount % 1000 === 0) {
            // Sadece uyarı logu basıyoruz, işlemi kesmiyoruz (Business Kararı)
            console.warn(`⚠️ [FRAUD MONITOR] Yüksek ve yuvarlak tutar tespit edildi: ${data.amount}`);
        }
    }

    // C. GEÇİCİ E-MAIL KONTROLÜ
    const suspiciousDomains = ['tempmail.com', '10minutemail.com', 'throwawaymail.com'];
    const emailDomain = data.customerInfo.email.split('@')[1];
    
    if (suspiciousDomains.includes(emailDomain)) {
        throw new Error("GÜVENLİK: Geçici (Disposable) email adresleri kabul edilmemektedir.");
    }

    return true; // Temiz
};

module.exports = { checkTransactionRisk };