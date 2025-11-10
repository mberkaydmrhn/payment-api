const errorHandler = (err, req, res, next) => {
  console.error('❌ Hata:', err);

  // Varsayılan hata yapısı
  let error = {
    code: 'INTERNAL_ERROR',
    message: 'Sunucu hatası oluştu',
    statusCode: 500
  };

  // Validation hataları
  if (err.name === 'ValidationError') {
    error = {
      code: 'VALIDATION_ERROR',
      message: 'Geçersiz veri',
      details: Object.values(err.errors).map(e => e.message),
      statusCode: 400
    };
  }

  // MongoDB duplicate key hatası
  if (err.code === 11000) {
    error = {
      code: 'DUPLICATE_ENTRY',
      message: 'Bu kayıt zaten mevcut',
      statusCode: 409
    };
  }

  // JWT hataları
  if (err.name === 'JsonWebTokenError') {
    error = {
      code: 'INVALID_TOKEN',
      message: 'Geçersiz token',
      statusCode: 401
    };
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details })
    }
  });
};

module.exports = errorHandler;