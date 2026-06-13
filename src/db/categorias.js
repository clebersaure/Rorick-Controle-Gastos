const prisma = require('./prisma');

async function listarCategorias() {
  return prisma.categoria.findMany({
    where: { ativo: true },
    include: { subcategorias: { where: { ativo: true }, orderBy: { nome: 'asc' } } },
    orderBy: { nome: 'asc' },
  });
}

async function criarCategoria(nome) {
  return prisma.categoria.upsert({
    where: { nome },
    update: { ativo: true },
    create: { nome },
  });
}

async function criarSubcategoria(nome, categoriaId) {
  return prisma.subcategoria.upsert({
    where: { nome_categoriaId: { nome, categoriaId } },
    update: { ativo: true },
    create: { nome, categoriaId },
  });
}

async function resolverCategoria(nomeSugerido) {
  if (!nomeSugerido) return null;

  const cat = await prisma.categoria.findFirst({
    where: {
      nome: { contains: nomeSugerido, mode: 'insensitive' },
      ativo: true,
    },
  });

  return cat;
}

async function resolverSubcategoria(nomeSugerido, categoriaId) {
  if (!nomeSugerido || !categoriaId) return null;

  return prisma.subcategoria.findFirst({
    where: {
      nome: { contains: nomeSugerido, mode: 'insensitive' },
      categoriaId,
      ativo: true,
    },
  });
}

module.exports = { listarCategorias, criarCategoria, criarSubcategoria, resolverCategoria, resolverSubcategoria };
