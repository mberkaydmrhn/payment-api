const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Payment API çalışıyor!',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/payments', require('./routes/payments'));

app.listen(PORT, () => {
  console.log(`🚀 Payment API: http://localhost:${PORT}`);
});