/**
 * Valida o WEBHOOK_SECRET enviado pelo Z-API no header ou query string.
 * Rejeita requisições com segredo incorreto.
 */
function validarWebhookSecret(req, res, next) {
  const secret = req.headers['x-webhook-secret'] || req.query.secret;

  if (!process.env.WEBHOOK_SECRET) {
    console.warn('[WebhookAuth] WEBHOOK_SECRET não configurado — pulando validação');
    return next();
  }

  if (secret !== process.env.WEBHOOK_SECRET) {
    console.warn(`[${new Date().toISOString()}] [WebhookAuth] Secret inválido — requisição bloqueada`);
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  next();
}

module.exports = { validarWebhookSecret };
