/**
 * Executa uma função assíncrona com retentativas e backoff exponencial.
 *
 * @param {Function} fn - função a tentar (deve retornar Promise)
 * @param {object}   opts
 * @param {number}   opts.tentativas     - total de tentativas (padrão: 3)
 * @param {number}   opts.delayMs        - delay inicial em ms (padrão: 1000)
 * @param {number}   opts.fatorBackoff   - multiplicador por tentativa (padrão: 2)
 * @param {Function} opts.deveRetentar   - (err) => boolean; padrão retenta sempre
 * @returns {Promise<any>}
 */
async function comRetry(fn, { tentativas = 3, delayMs = 1000, fatorBackoff = 2, deveRetentar } = {}) {
  let delay = delayMs;

  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (err) {
      const ehUltima = i === tentativas - 1;
      const retentavel = deveRetentar ? deveRetentar(err) : true;

      if (ehUltima || !retentavel) throw err;

      console.warn(`[Retry] Tentativa ${i + 1}/${tentativas} falhou (${err.message}). Aguardando ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * fatorBackoff, 30_000); // cap em 30s
    }
  }
}

/**
 * Retorna true para erros transitórios da OpenAI (timeout, rate-limit, 5xx).
 */
function erroOpenAITransitorio(err) {
  if (!err) return false;
  // Status HTTP retornado pelo SDK da OpenAI
  if (err.status === 429 || err.status >= 500) return true;
  // Timeout / network
  const msg = (err.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('network');
}

/**
 * Retorna true para erros transitórios do axios (timeout, 5xx, network).
 */
function erroAxiosTransitorio(err) {
  if (!err) return false;
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true;
  if (err.response?.status >= 500) return true;
  return false;
}

module.exports = { comRetry, erroOpenAITransitorio, erroAxiosTransitorio };
