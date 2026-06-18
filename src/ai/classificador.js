require('dotenv').config();
const OpenAI = require('openai');
const prisma = require('../db/prisma');
const { comRetry, erroOpenAITransitorio } = require('../utils/retry');
const { parseJsonModelo } = require('../utils/jsonSafe');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 0,
});

async function montarPromptSistema() {
  const categorias = await prisma.categoria.findMany({
    where: { ativo: true },
    include: { subcategorias: { where: { ativo: true }, orderBy: { nome: 'asc' } } },
    orderBy: { nome: 'asc' },
  });

  const listaCategorias = categorias
    .map((c) => {
      const subs = c.subcategorias.map((s) => s.nome).join(', ');
      return subs ? `- ${c.nome} (subcategorias: ${subs})` : `- ${c.nome}`;
    })
    .join('\n');

  return `Você é um assistente financeiro da empresa de engenharia Rorick.
Analise a descrição de um gasto e extraia os dados estruturados.

Retorne APENAS um JSON válido, sem markdown, sem explicações adicionais.

Formato obrigatório:
{
  "valor": <número decimal ou null>,
  "data": "<YYYY-MM-DD ou null>",
  "fornecedor": "<nome do estabelecimento ou null>",
  "descricao": "<descrição resumida do gasto ou null>",
  "categoria_sugerida": "<nome exato de uma das categorias abaixo ou null>",
  "subcategoria_sugerida": "<nome exato de uma subcategoria da categoria escolhida ou null>"
}

Categorias disponíveis:
${listaCategorias}

Regras de classificação:
- gasolina, diesel, etanol, combustível → Combustível
- almoço, café da manhã, janta, refeição, lanche → Alimentação
- cimento, ferro, areia, tijolo, tinta → Material
- hotel, pousada, hospedagem → Hospedagem
- peão, servente, carpinteiro, mão de obra → Mão de Obra
- capacete, bota, colete, EPI → EPI
- martelo, furadeira, ferramenta → Ferramentas
- projeto, planta, alvará, ART → Documentação
- Se não souber a categoria, retorne null em categoria_sugerida
- Se não conseguir extrair valor, retorne null em valor`;
}

/**
 * Interpreta texto livre ou transcrição de áudio, classifica o gasto
 * e retorna os dados estruturados junto com o objeto Categoria do banco.
 *
 * @param {string} texto - mensagem do usuário ou transcrição Whisper
 * @returns {{ dados: object, categoria: object|null }}
 */
async function classificarTexto(texto) {
  console.log(`[Classificador] Classificando: "${texto.substring(0, 80)}"`);

  // Carrega categorias do banco (com retry para indisponibilidade temporária)
  const promptSistema = await comRetry(() => montarPromptSistema(), {
    tentativas: 3,
    delayMs: 1000,
    deveRetentar: (err) => err.message?.includes('connect') || err.message?.includes('timeout'),
  });

  const resposta = await comRetry(
    async () => {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0,
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: texto },
        ],
      });
      return response.choices[0].message.content.trim();
    },
    { tentativas: 3, delayMs: 2000, deveRetentar: erroOpenAITransitorio }
  );

  console.log(`[Classificador] Resultado bruto: ${resposta}`);

  // JSON malformado → retorna dados neutros para não bloquear o fluxo
  let dados;
  try {
    dados = parseJsonModelo(resposta, 'Classificador');
  } catch (err) {
    console.warn(`[Classificador] JSON inválido — usando dados neutros: ${err.message}`);
    dados = { valor: null, data: null, fornecedor: null, descricao: texto.substring(0, 200), categoria_sugerida: null, subcategoria_sugerida: null };
  }

  if (!dados.data) {
    dados.data = new Date().toISOString().split('T')[0];
  }

  let categoria = null;
  if (dados.categoria_sugerida) {
    categoria = await prisma.categoria.findFirst({
      where: { nome: { equals: dados.categoria_sugerida, mode: 'insensitive' }, ativo: true },
      include: { subcategorias: { where: { ativo: true } } },
    });

    if (!categoria) {
      categoria = await prisma.categoria.findFirst({
        where: { nome: { contains: dados.categoria_sugerida, mode: 'insensitive' }, ativo: true },
        include: { subcategorias: { where: { ativo: true } } },
      });
    }
  }

  console.log(`[Classificador] Categoria resolvida: ${categoria?.nome ?? 'não identificada'}`);

  return { dados, categoria };
}

module.exports = { classificarTexto };
