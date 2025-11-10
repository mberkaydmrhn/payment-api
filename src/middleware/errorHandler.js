const errorHandler = (err, req, res, next) => {
  console.error('❌ Hata:', err);

  let error = {
    code: 'INTERNAL_ERROR',
    message: 'Sunucu hatası oluştu',
    statusCode: 500
  };

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message
    }
  });
};

module.exports = errorHandler;