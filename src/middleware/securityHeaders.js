const helmet = require('helmet');

const securityHeaders = helmet({
  contentSecurityPolicy: false // CSP'yi devre dışı bırak
});

module.exports = securityHeaders;