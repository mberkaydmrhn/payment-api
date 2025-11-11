const helmet = require('helmet');

const securityHeaders = helmet({
  contentSecurityPolicy: false, // CSS ve JS engellemeyi kapat
  crossOriginEmbedderPolicy: false
});

module.exports = securityHeaders;