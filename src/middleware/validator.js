const { z } = require('zod');

// Ödeme Oluşturma Şeması
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

    provider: z.enum(['iyzico', 'stripe', 'mock']).default('mock'),

    customerInfo: z.object({
        name: z.string().min(3, "İsim en az 3 karakter olmalı"),
        email: z.string().email("Geçersiz e-mail formatı")
    }),

    webhookUrl: z.string().url("Geçersiz Webhook URL").optional().or(z.literal('')),
    returnUrl: z.string().url().optional()
});

const validatePayment = (req, res, next) => {
    try {
        // 1. Body kontrolü
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new Error("İstek gövdesi (body) boş olamaz.");
        }

        // 2. Zod ile doğrulama
        const validData = createPaymentSchema.parse(req.body);
        
        // 3. Temiz veriyi kaydet
        req.body = validData;
        next();

    } catch (error) {
        let errorMessage = "Doğrulama hatası";

        // HATA AYIKLAMA: Gelen hatanın türüne göre mesaj oluştur
        if (error instanceof z.ZodError) {
            // Zod hatasıysa detayları birleştir
            errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        } else if (error instanceof Error) {
            // Standart hataysa mesajı al
            errorMessage = error.message;
        } else {
            // Bilinmeyen bir şeyse
            errorMessage = String(error);
        }

        console.error("❌ Validation Error:", errorMessage);

        return res.status(400).json({
            success: false,
            error: { 
                code: 'VALIDATION_ERROR', 
                message: errorMessage 
            }
        });
    }
};

module.exports = { validatePayment };