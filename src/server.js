require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./api/routes');
const { handleWebhook } = require('./bot/webhook');
const { validarWebhookSecret } = require('./api/middlewares/webhookAuth');

const app = express();

// Segurança e parsing
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));

// Rotas da API REST
app.use('/api', apiRoutes);

// Webhook do Z-API (validado por secret)
app.post('/webhook/whatsapp', validarWebhookSecret, handleWebhook);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Handler de rotas não encontradas
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Handler global de erros assíncronos
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] [Server] Erro não tratado:`, err.message);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] [Server] Rodando na porta ${PORT} — ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
