require('dotenv').config();
const OpenAI = require('openai');
const prisma = require('../db/prisma');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Monta o prompt de sistema dinamicamente com as categorias e subcategorias
 * ativas no banco — assim o modelo sempre trabalha com dados atualizados.
 */
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
 * @returns {{ dados: object, categoria: object|null }} dados extraídos e objeto Categoria
 */
async function classificarTexto(texto) {
  console.log(`[${new Date().toISOString()}] [Classificador] Classificando: "${texto.substring(0, 80)}"`);

  const promptSistema = await montarPromptSistema();

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini',
    max_tokens: 300,
    temperature: 0,
    messages: [
      { role: 'system', content: promptSistema },
      { role: 'user', content: texto },
    ],
  });

  const resposta = response.choices[0].message.content.trim();
  console.log(`[${new Date().toISOString()}] [Classificador] Resultado bruto: ${resposta}`);

  const dados = JSON.parse(resposta);

  // Normaliza data ausente para hoje
  if (!dados.data) {
    dados.data = new Date().toISOString().split('T')[0];
  }

  // Busca o objeto Categoria no banco pelo nome sugerido (match exato insensível)
  let categoria = null;
  if (dados.categoria_sugerida) {
    categoria = await prisma.categoria.findFirst({
      where: {
        nome: { equals: dados.categoria_sugerida, mode: 'insensitive' },
        ativo: true,
      },
      include: { subcategorias: { where: { ativo: true } } },
    });

    // Fallback: busca por contém se exato não encontrou
    if (!categoria) {
      categoria = await prisma.categoria.findFirst({
        where: {
          nome: { contains: dados.categoria_sugerida, mode: 'insensitive' },
          ativo: true,
        },
        include: { subcategorias: { where: { ativo: true } } },
      });
    }
  }

  console.log(`[${new Date().toISOString()}] [Classificador] Categoria resolvida: ${categoria?.nome ?? 'não identificada'}`);

  return { dados, categoria };
}

module.exports = { classificarTexto };
