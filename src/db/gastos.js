const prisma = require('./prisma');

async function salvarGasto({ valor, data, fornecedor, descricao, categoriaId, subcategoriaId, usuarioId, obraId, imagemUrl, fonte }) {
  if (!valor || valor <= 0) throw new Error('valor deve ser maior que zero');
  if (!data) throw new Error('data é obrigatória');
  if (!categoriaId) throw new Error('categoriaId é obrigatório');
  if (!usuarioId) throw new Error('usuarioId é obrigatório');

  return prisma.gasto.create({
    data: {
      valor,
      data: new Date(data),
      fornecedor,
      descricao,
      categoriaId,
      subcategoriaId: subcategoriaId || null,
      usuarioId,
      obraId: obraId || null,
      imagemUrl,
      fonte: fonte || 'TEXTO',
    },
    include: { categoria: true, subcategoria: true, usuario: true, obra: true },
  });
}

async function listarGastos({ mes, ano, categoriaId, usuarioId, obraId, page = 1, limit = 50 } = {}) {
  const where = {};

  if (mes && ano) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);
    where.data = { gte: inicio, lt: fim };
  } else if (ano) {
    where.data = { gte: new Date(ano, 0, 1), lt: new Date(ano + 1, 0, 1) };
  }

  if (categoriaId) where.categoriaId = Number(categoriaId);
  if (usuarioId) where.usuarioId = Number(usuarioId);
  if (obraId) where.obraId = Number(obraId);

  const [total, items] = await Promise.all([
    prisma.gasto.count({ where }),
    prisma.gasto.findMany({
      where,
      include: { categoria: true, subcategoria: true, usuario: true, obra: true },
      orderBy: { data: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { total, page, limit, items };
}

/**
 * Agrupa total gasto por mês nos últimos 12 meses (ou no ano informado).
 * Sempre retorna os 12 meses do período, mesmo os sem lançamentos (total = 0).
 */
async function resumoMensal(ano) {
  const anoRef = ano || new Date().getFullYear();
  const inicio = new Date(anoRef, 0, 1);
  const fim = new Date(anoRef + 1, 0, 1);

  const gastos = await prisma.gasto.findMany({
    where: { data: { gte: inicio, lt: fim } },
    select: { valor: true, data: true },
  });

  // Inicializa todos os 12 meses com zero para garantir série completa no gráfico
  const porMes = {};
  for (let m = 1; m <= 12; m++) {
    porMes[m] = { mes: m, total: 0, quantidade: 0 };
  }

  for (const g of gastos) {
    const mes = g.data.getMonth() + 1;
    porMes[mes].total = parseFloat((porMes[mes].total + parseFloat(g.valor)).toFixed(2));
    porMes[mes].quantidade += 1;
  }

  return Object.values(porMes);
}

/**
 * Total por categoria em um determinado mês/ano.
 * Se mes e ano não forem passados, considera todos os lançamentos.
 */
async function resumoPorCategoria({ mes, ano } = {}) {
  const where = {};
  if (mes && ano) {
    where.data = {
      gte: new Date(ano, mes - 1, 1),
      lt: new Date(ano, mes, 1),
    };
  }

  const gastos = await prisma.gasto.findMany({
    where,
    select: { valor: true, categoria: { select: { nome: true } } },
  });

  const porCat = {};
  for (const g of gastos) {
    const nome = g.categoria.nome;
    if (!porCat[nome]) porCat[nome] = 0;
    porCat[nome] = parseFloat((porCat[nome] + parseFloat(g.valor)).toFixed(2));
  }

  return Object.entries(porCat)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
}

module.exports = { salvarGasto, listarGastos, resumoMensal, resumoPorCategoria };
