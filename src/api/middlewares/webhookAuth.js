/**
 * Valida o WEBHOOK_SECRET enviado pelo Z-API.
 * Z-API não suporta headers customizados na UI — aceita via query param (?secret=).
 * O secret no parâmetro é aceitável aqui porque o Railway usa HTTPS obrigatório,
 * e a URL completa não é exposta em logs públicos.
 */
function validarWebhookSecret(req, res, next) {
  if (!process.env.WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[WebhookAuth] WEBHOOK_SECRET não configurado em produção — bloqueando webhook');
      return res.status(503).json({ erro: 'Serviço temporariamente indisponível' });
    }
    console.warn('[WebhookAuth] WEBHOOK_SECRET não configurado — pulando validação (dev)');
    return next();
  }

  // Aceita via query param (?secret=) ou header (x-webhook-secret)
  const secret = req.query.secret || req.headers['x-webhook-secret'];

  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.warn(`[WebhookAuth] Secret inválido ou ausente — IP: ${req.ip}`);
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  next();
}

module.exports = { validarWebhookSecret };
