// src/utils/logger.js

// Hassas verileri maskeleme fonksiyonu
const maskData = (data) => {
    if (!data) return data;
    
    // Objenin kopyasını al (Orijinali bozmamak için)
    const masked = JSON.parse(JSON.stringify(data));

    // Email Maskeleme (ab***@domain.com)
    if (masked.customerInfo && masked.customerInfo.email) {
        const parts = masked.customerInfo.email.split('@');
        if (parts.length === 2) {
            masked.customerInfo.email = `${parts[0].substring(0, 2)}***@${parts[1]}`;
        }
    }

    // İsim Maskeleme (Ah*** Yıl***)
    if (masked.customerInfo && masked.customerInfo.name) {
        const parts = masked.customerInfo.name.split(' ');
        masked.customerInfo.name = parts.map(p => p[0] + '***').join(' ');
    }

    // Kart bilgisi varsa sil (Asla loglanmamalı)
    if (masked.cardNumber) delete masked.cardNumber;
    if (masked.cvc) delete masked.cvc;
    if (masked.cvv) delete masked.cvv;
    if (masked.expiry) delete masked.expiry;

    return masked;
};

const logInfo = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const dataStr = data ? JSON.stringify(maskData(data)) : '';
    console.log(`✅ [${timestamp}] INFO: ${message} ${dataStr}`);
};

const logError = (message, error) => {
    const timestamp = new Date().toLocaleTimeString();
    console.error(`❌ [${timestamp}] ERROR: ${message}`, error);
};

const logWarn = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    console.warn(`⚠️ [${timestamp}] WARN: ${message}`);
};

module.exports = { logInfo, logError, logWarn, maskData };