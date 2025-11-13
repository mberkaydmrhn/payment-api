// src/middleware/validator.js
const { z } = require('zod');

const createPaymentSchema = z.object({
    amount: z.preprocess(
        (val) => Number(val),
        z.number({ required_error: "Tutar zorunludur" })
         .positive("Tutar pozitif olmalıdır")
         .min(1, "Minimum tutar 1 olmalıdır")
         .max(100000, "Maksimum işlem limiti 100.000'dir")
    ),
        
    currency: z.enum(['TRY', 'USD', 'EUR'], { 
        errorMap: () => ({ message: "Geçersiz para birimi (TRY, USD, EUR)" }) 
    }).default('TRY'),

    description: z.string()
        .min(3, "Açıklama çok kısa")
        .max(100, "Açıklama çok uzun")
        .regex(/^[a-zA-Z0-9\sğüşıöçĞÜŞİÖÇ.,-]+$/, "Açıklamada geçersiz karakterler var"),

    provider: z.enum(['iyzico', 'stripe', 'mock']),

    customerInfo: z.object({
        name: z.string().min(3, "İsim en az 3 karakter olmalı"),
        email: z.string().email("Geçersiz e-mail formatı")
    }),

    webhookUrl: z.string().url("Geçersiz Webhook URL").optional().or(z.literal('')),
    returnUrl: z.string().url().optional()
});

const validatePayment = (req, res, next) => {
    try {
        if (!req.body) throw new Error("İstek gövdesi (body) boş gönderilemez.");

        const validData = createPaymentSchema.parse(req.body);
        req.body = validData;
        next();

    } catch (error) {
        let errorMessage = "Bilinmeyen doğrulama hatası";

        if (error instanceof z.ZodError) {
            errorMessage = error.errors.map(e => e.message).join(', ');
        } else if (error.message) {
            errorMessage = error.message;
        }

        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: errorMessage }
        });
    }
};

module.exports = { validatePayment };