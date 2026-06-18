const OpenAI = require('openai');
const { comRetry, erroOpenAITransitorio } = require('../utils/retry');
const { parseJsonModelo } = require('../utils/jsonSafe');

// Timeout de 45s por requisição e até 2 retentativas automáticas do SDK
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 45_000,
  maxRetries: 0, // gerenciamos manualmente para logar cada tentativa
});

const PROMPT_SISTEMA = `Você é um assistente especializado em leitura de notas fiscais e cupons fiscais brasileiros.
Analise a imagem fornecida e extraia os dados financeiros.

Retorne APENAS um JSON válido, sem markdown, sem explicações, sem texto adicional.

Formato obrigatório:
{
  "valor": <número decimal>,
  "data": "<YYYY-MM-DD>",
  "fornecedor": "<nome do estabelecimento ou null>",
  "descricao": "<descrição breve do que foi comprado ou null>",
  "categoria_sugerida": "<uma das categorias: Material, Ferramentas, Documentação, EPI, Alimentação, Combustível, Hospedagem, Mão de Obra, Supervisão, Terceiros, ou null>",
  "subcategoria_sugerida": "<subcategoria mais adequada ou null>"
}

Regras:
- valor deve ser um número (ex: 125.50), não string
- data no formato YYYY-MM-DD; se não encontrar, use a data de hoje
- Se não conseguir extrair valor ou a imagem for ilegível, retorne: {"erro": "legibilidade insuficiente"}
- Campos opcionais podem ser null mas nunca omitidos`;

/**
 * Extrai dados de uma nota fiscal a partir de URL pública ou base64.
 * Retenta até 3 vezes em erros transitórios (timeout, 429, 5xx).
 *
 * @param {string} imagemUrl - URL pública ou data URL base64
 * @returns {object} dados extraídos ou { erro: string }
 */
async function extrairDadosNota(imagemUrl) {
  console.log(`[OCR] Chamando GPT-4o Vision para: ${imagemUrl.substring(0, 60)}...`);

  const texto = await comRetry(
    async () => {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL_VISION || 'gpt-4o',
        max_tokens: 500,
        messages: [
          { role: 'system', content: PROMPT_SISTEMA },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia os dados desta nota fiscal:' },
              { type: 'image_url', image_url: { url: imagemUrl, detail: 'high' } },
            ],
          },
        ],
      });
      return response.choices[0].message.content.trim();
    },
    { tentativas: 3, delayMs: 2000, deveRetentar: erroOpenAITransitorio }
  );

  console.log(`[OCR] Resposta recebida: ${texto.substring(0, 100)}`);

  // JSON malformado retornado pelo modelo → trata como legibilidade insuficiente
  let dados;
  try {
    dados = parseJsonModelo(texto, 'OCR');
  } catch (err) {
    console.warn(`[OCR] Falha ao parsear JSON: ${err.message}`);
    return { erro: 'legibilidade insuficiente' };
  }

  if (dados.erro) {
    console.warn(`[OCR] Imagem ilegível: ${dados.erro}`);
    return dados;
  }

  if (typeof dados.valor !== 'number' || dados.valor <= 0) {
    return { erro: 'valor inválido ou não encontrado' };
  }
  if (!dados.data || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
    dados.data = new Date().toISOString().split('T')[0];
  }

  return dados;
}

/**
 * Extrai dados de imagem em base64 (para upload via web).
 * @param {Buffer} buffer   - buffer da imagem
 * @param {string} mimeType - ex: 'image/jpeg'
 */
async function extrairDadosNotaBase64(buffer, mimeType = 'image/jpeg') {
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;
  return extrairDadosNota(dataUrl);
}

module.exports = { extrairDadosNota, extrairDadosNotaBase64 };
