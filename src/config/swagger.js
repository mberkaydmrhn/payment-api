const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path'); // Bu satırı ekleyin

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PayMint API',
      version: '1.0.0',
      description: "Bubble.io ve No-Code platformları için Ödeme API'si. Iyzico, Stripe ve Mock destekler.",
      contact: {
        name: "PayMint Support",
        url: "https://paymint.io",
        email: "support@paymint.io"
      },
    },
    servers: [
      {
        url: 'https://payment-api-9g10.onrender.com',
        description: 'Production Server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key'
        }
      }
    }
  },
  apis: [path.join(__dirname, '../routes/*.js')], 
};

const specs = swaggerJsdoc(options);
module.exports = specs;