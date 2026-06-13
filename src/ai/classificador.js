const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CATEGORIAS_VALIDAS = [
  'Material', 'Ferramentas', 'Documentação', 'EPI',
  'Alimentação', 'Combustível', 'Hospedagem',
  'Mão de Obra', 'Supervisão', 'Terceiros',
];

const PROMPT_SISTEMA = `Você é um assistente financeiro da empresa de engenharia Rorick.
Interprete a mensagem do usuário sobre um gasto e extraia os dados estruturados.

Retorne APENAS um JSON válido, sem markdown, sem explicações.

Formato:
{
  "valor": <número decimal ou null>,
  "data": "<YYYY-MM-DD ou null>",
  "fornecedor": "<nome do estabelecimento ou null>",
  "descricao": "<descrição do gasto ou null>",
  "categoria_sugerida": "<uma das categorias válidas ou null>",
  "subcategoria_sugerida": "<subcategoria mais adequada ou null>"
}

Categorias válidas: Material, Ferramentas, Documentação, EPI, Alimentação, Combustível, Hospedagem, Mão de Obra, Supervisão, Terceiros.

Se a mensagem mencionar combustível/gasolina/diesel → Combustível
Se mencionar almoço/café/refeição → Alimentação
Se mencionar material de construção → Material
Se não conseguir extrair valor, retorne valor: null`;

/**
 * Interpreta texto livre ou transcrição de áudio e extrai dados do gasto.
 * @param {string} texto - mensagem do usuário ou transcrição
 * @returns {object} dados estruturados do gasto
 */
async function classificarTexto(texto) {
  console.log(`[${new Date().toISOString()}] [Classificador] Interpretando: "${texto.substring(0, 80)}"`);

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini',
    max_tokens: 300,
    messages: [
      { role: 'system', content: PROMPT_SISTEMA },
      { role: 'user', content: texto },
    ],
  });

  const resposta = response.choices[0].message.content.trim();
  console.log(`[${new Date().toISOString()}] [Classificador] Resultado: ${resposta}`);

  const dados = JSON.parse(resposta);

  // Normaliza data para hoje se ausente
  if (!dados.data) {
    dados.data = new Date().toISOString().split('T')[0];
  }

  // Valida categoria
  if (dados.categoria_sugerida && !CATEGORIAS_VALIDAS.includes(dados.categoria_sugerida)) {
    dados.categoria_sugerida = null;
  }

  return dados;
}

module.exports = { classificarTexto, CATEGORIAS_VALIDAS };
