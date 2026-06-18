require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const prisma = require('./db/prisma');

// ── Validação de variáveis obrigatórias ──────────────────────────────────────
// Falha rápido no boot — melhor crashar na inicialização do que em produção
const ENV_OBRIGATORIAS = ['JWT_SECRET', 'DATABASE_URL', 'ZAPI_TOKEN', 'ZAPI_INSTANCE_ID', 'OPENAI_API_KEY'];
if (process.env.NODE_ENV === 'production') {
  ENV_OBRIGATORIAS.push('WEBHOOK_SECRET');
}
const faltando = ENV_OBRIGATORIAS.filter((v) => !process.env[v]);
if (faltando.length > 0) {
  console.error(`[Server] ERRO: variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('[Server] ERRO: JWT_SECRET deve ter pelo menos 32 caracteres');
  process.exit(1);
}
// ────────────────────────────────────────────────────────────────────────────

const apiRoutes = require('./api/routes');
const { handleWebhook } = require('./bot/webhook');
const { validarWebhookSecret } = require('./api/middlewares/webhookAuth');
const { limiterWebhookPorTelefone } = require('./api/middlewares/rateLimiter');

const app = express();

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

// Webhook do Z-API: autenticação por secret + rate limit por número de telefone
app.post('/webhook/whatsapp', validarWebhookSecret, limiterWebhookPorTelefone, handleWebhook);

// Health check com verificação de conectividade do banco
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'unavailable', ts: new Date().toISOString() });
  }
});

// Frontend estático (build do Vite copiado pelo Dockerfile para /app/public)
// Em dev, o Vite roda em porta separada e o proxy cuida do /api
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  // SPA fallback: qualquer rota não-API retorna o index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
} else {
  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
}

app.use((err, req, res, next) => {
  console.error(`[Server] Erro não tratado:`, err.message);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// Captura rejeições não tratadas sem derrubar o processo
process.on('unhandledRejection', (reason) => {
  console.error('[Server] UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] UncaughtException:', err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Rodando na porta ${PORT} — ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
