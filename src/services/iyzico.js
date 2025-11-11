// src/services/iyzico.js
const Iyzipay = require('iyzipay');
require('dotenv').config();

const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_BASE_URL
});

// Ödeme Formunu Başlat
const initializePayment = (data) => {
    return new Promise((resolve, reject) => {
        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId: data.paymentId,
            price: data.amount.toString(),
            paidPrice: data.amount.toString(),
            currency: Iyzipay.CURRENCY.TRY,
            basketId: data.paymentId,
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            callbackUrl: `${data.baseUrl}/api/payments/iyzico/callback`,
            enabledInstallments: [1, 2, 3, 6, 9],
            buyer: {
                id: data.paymentId,
                name: data.customerInfo.name.split(' ')[0] || 'Misafir',
                surname: data.customerInfo.name.split(' ').slice(1).join(' ') || 'Kullanıcı',
                gsmNumber: '+905300000000',
                email: data.customerInfo.email,
                identityNumber: '11111111111',
                lastLoginDate: '2015-10-05 12:43:35',
                registrationAddress: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
                ip: data.ip,
                city: 'Istanbul',
                country: 'Turkey',
                zipCode: '34732'
            },
            shippingAddress: {
                contactName: data.customerInfo.name,
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Test Adresi',
                zipCode: '34732'
            },
            billingAddress: {
                contactName: data.customerInfo.name,
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Test Adresi',
                zipCode: '34732'
            },
            basketItems: [
                {
                    id: 'BI101',
                    name: data.description,
                    category1: 'Dijital Ürün',
                    itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
                    price: data.amount.toString()
                }
            ]
        };

        iyzipay.checkoutFormInitialize.create(request, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

// YENİ: Ödeme Sonucunu Sorgula (Callback için)
const retrievePaymentResult = (token) => {
    return new Promise((resolve, reject) => {
        iyzipay.checkoutForm.retrieve({ token: token }, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

module.exports = { initializePayment, retrievePaymentResult };