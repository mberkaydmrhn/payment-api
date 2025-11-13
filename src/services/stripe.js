// src/services/stripe.js
const Stripe = require('stripe');
require('dotenv').config();

// Stripe'ı başlat
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createCheckoutSession = async (data) => {
    try {
        // Gelen para birimini al (Yoksa varsayılan USD yap)
        // Stripe küçük harf ister: 'try', 'usd', 'eur'
        const currencyCode = data.currency ? data.currency.toLowerCase() : 'usd';

        // Stripe Oturumu Oluştur
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currencyCode, // 🔥 DİNAMİK PARA BİRİMİ
                        product_data: {
                            name: data.description,
                            description: `Müşteri: ${data.customerInfo.name}`,
                        },
                        // Stripe kuruş cinsinden çalışır (100 = 1.00 birim)
                        // Math.round floating point hatalarını önler
                        unit_amount: Math.round(data.amount * 100), 
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // Başarılı olursa nereye dönsün?
            success_url: `${data.baseUrl}/api/payments/stripe/callback?session_id={CHECKOUT_SESSION_ID}`,
            // İptal olursa nereye dönsün?
            cancel_url: `${data.baseUrl}/api/payments/stripe/callback?session_id={CHECKOUT_SESSION_ID}&cancel=true`,
            // Müşteri mailini otomatik doldur
            customer_email: data.customerInfo.email,
            // Bizim paymentId'mizi metadata olarak sakla
            metadata: {
                paymentId: data.paymentId
            }
        });

        return session;
    } catch (error) {
        throw error;
    }
};

// Ödeme Sonucunu Sorgula
const retrieveSession = async (sessionId) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        return session;
    } catch (error) {
        throw error;
    }
};

module.exports = { createCheckoutSession, retrieveSession };