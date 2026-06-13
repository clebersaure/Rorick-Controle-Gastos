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

  if (categoriaId) where.categoriaId = categoriaId;
  if (usuarioId) where.usuarioId = usuarioId;
  if (obraId) where.obraId = obraId;

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

async function resumoMensal(ano) {
  const anoAtual = ano || new Date().getFullYear();
  const inicio = new Date(anoAtual, 0, 1);
  const fim = new Date(anoAtual + 1, 0, 1);

  const gastos = await prisma.gasto.findMany({
    where: { data: { gte: inicio, lt: fim } },
    select: { valor: true, data: true, categoriaId: true, categoria: { select: { nome: true } } },
  });

  // Agrupa por mês
  const porMes = {};
  for (const g of gastos) {
    const mes = g.data.getMonth() + 1;
    if (!porMes[mes]) porMes[mes] = { mes, total: 0, quantidade: 0 };
    porMes[mes].total += parseFloat(g.valor);
    porMes[mes].quantidade += 1;
  }

  return Object.values(porMes).sort((a, b) => a.mes - b.mes);
}

async function resumoPorCategoria({ mes, ano } = {}) {
  const where = {};
  if (mes && ano) {
    where.data = { gte: new Date(ano, mes - 1, 1), lt: new Date(ano, mes, 1) };
  }

  const gastos = await prisma.gasto.findMany({
    where,
    select: { valor: true, categoria: { select: { nome: true } } },
  });

  const porCat = {};
  for (const g of gastos) {
    const nome = g.categoria.nome;
    if (!porCat[nome]) porCat[nome] = 0;
    porCat[nome] += parseFloat(g.valor);
  }

  return Object.entries(porCat)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
}

module.exports = { salvarGasto, listarGastos, resumoMensal, resumoPorCategoria };
