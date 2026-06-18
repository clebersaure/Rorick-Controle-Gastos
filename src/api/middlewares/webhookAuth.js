/**
 * Valida o WEBHOOK_SECRET enviado pelo Z-API SOMENTE via header HTTP.
 * Query params são intencionalmente rejeitados — aparecem em logs de CDN/proxy.
 *
 * Em produção, falha imediatamente se a variável não estiver configurada.
 */
function validarWebhookSecret(req, res, next) {
  // Rejeita explicitamente tentativas via query param
  if (req.query.secret) {
    console.warn('[WebhookAuth] Tentativa de autenticação via query param bloqueada');
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  if (!process.env.WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      // Em produção, sem secret configurado é erro de configuração — bloqueia tudo
      console.error('[WebhookAuth] WEBHOOK_SECRET não configurado em produção — bloqueando webhook');
      return res.status(503).json({ erro: 'Serviço temporariamente indisponível' });
    }
    // Em dev/test, permite mas avisa
    console.warn('[WebhookAuth] WEBHOOK_SECRET não configurado — pulando validação (ambiente não-produção)');
    return next();
  }

  const secret = req.headers['x-webhook-secret'];

  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.warn(`[WebhookAuth] Secret inválido ou ausente — IP: ${req.ip}`);
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  next();
}

module.exports = { validarWebhookSecret };
