/**
 * Rate limiter em memória usando sliding-window counter.
 * Adequado para instância única (single-process). Para multi-instância,
 * substituir o Map por Redis.
 *
 * @param {object} opts
 * @param {number} opts.maxReqs   - requisições máximas na janela
 * @param {number} opts.windowMs  - tamanho da janela em ms
 * @param {string} opts.chave     - nome exibido na mensagem de erro
 * @param {Function} [opts.keyFn] - (req) => string; padrão = IP do cliente
 */
function criarLimiter({ maxReqs, windowMs, chave = 'requisições', keyFn }) {
  // Map: identificador → [timestamps]
  const contadores = new Map();

  // Limpeza periódica para evitar leak de memória
  setInterval(() => {
    const corte = Date.now() - windowMs;
    for (const [id, timestamps] of contadores) {
      const filtrado = timestamps.filter((t) => t > corte);
      if (filtrado.length === 0) contadores.delete(id);
      else contadores.set(id, filtrado);
    }
  }, windowMs).unref(); // .unref() não impede o processo de encerrar

  return function limiter(req, res, next) {
    const id = keyFn ? keyFn(req) : (req.ip || req.socket?.remoteAddress || 'desconhecido');
    const agora = Date.now();
    const corte = agora - windowMs;

    const historico = (contadores.get(id) || []).filter((t) => t > corte);
    historico.push(agora);
    contadores.set(id, historico);

    if (historico.length > maxReqs) {
      const resetEm = Math.ceil((historico[0] + windowMs - agora) / 1000);
      res.setHeader('Retry-After', resetEm);
      return res.status(429).json({
        erro: `Muitas ${chave}. Tente novamente em ${resetEm}s.`,
      });
    }

    next();
  };
}

// Login: 10 tentativas por IP a cada 15 minutos
const limiterLogin = criarLimiter({
  maxReqs: 10,
  windowMs: 15 * 60 * 1000,
  chave: 'tentativas de login',
});

// Webhook: 30 mensagens por número de telefone por minuto
const limiterWebhookPorTelefone = criarLimiter({
  maxReqs: 30,
  windowMs: 60 * 1000,
  chave: 'mensagens por número',
  keyFn: (req) => {
    // Extrai o telefone do payload Z-API sem processamento completo
    const phone = req.body?.phone || req.body?.from || 'desconhecido';
    return String(phone).replace(/\D/g, '');
  },
});

module.exports = { criarLimiter, limiterLogin, limiterWebhookPorTelefone };
