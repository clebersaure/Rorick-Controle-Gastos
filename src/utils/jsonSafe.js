/**
 * Faz parse de JSON retornado pela OpenAI, tolerando markdown code fences.
 * Lança erro descritivo se o JSON for inválido, incluindo o trecho recebido.
 *
 * @param {string} texto   - texto bruto retornado pelo modelo
 * @param {string} origem  - nome do módulo (para logs)
 * @returns {object}
 */
function parseJsonModelo(texto, origem = 'Modelo') {
  // Remove possíveis code fences que o modelo às vezes inclui
  const limpo = texto
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(limpo);
  } catch (err) {
    const trecho = limpo.substring(0, 200);
    throw new Error(`[${origem}] JSON inválido retornado pelo modelo: ${err.message}. Trecho: "${trecho}"`);
  }
}

module.exports = { parseJsonModelo };
