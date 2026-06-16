const prisma = require('./prisma');

async function listarCategorias() {
  return prisma.categoria.findMany({
    where: { ativo: true },
    include: {
      subcategorias: { where: { ativo: true }, orderBy: { nome: 'asc' } },
    },
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

async function renomearCategoria(id, novoNome) {
  return prisma.categoria.update({
    where: { id: Number(id) },
    data: { nome: novoNome },
  });
}

async function desativarCategoria(id) {
  return prisma.categoria.update({
    where: { id: Number(id) },
    data: { ativo: false },
  });
}

async function criarSubcategoria(nome, categoriaId) {
  return prisma.subcategoria.upsert({
    where: { nome_categoriaId: { nome, categoriaId: Number(categoriaId) } },
    update: { ativo: true },
    create: { nome, categoriaId: Number(categoriaId) },
  });
}

async function renomearSubcategoria(id, novoNome) {
  return prisma.subcategoria.update({
    where: { id: Number(id) },
    data: { nome: novoNome },
  });
}

async function desativarSubcategoria(id) {
  return prisma.subcategoria.update({
    where: { id: Number(id) },
    data: { ativo: false },
  });
}

async function resolverCategoria(nomeSugerido) {
  if (!nomeSugerido) return null;
  return prisma.categoria.findFirst({
    where: { nome: { contains: nomeSugerido, mode: 'insensitive' }, ativo: true },
  });
}

async function resolverSubcategoria(nomeSugerido, categoriaId) {
  if (!nomeSugerido || !categoriaId) return null;
  return prisma.subcategoria.findFirst({
    where: {
      nome: { contains: nomeSugerido, mode: 'insensitive' },
      categoriaId: Number(categoriaId),
      ativo: true,
    },
  });
}

module.exports = {
  listarCategorias,
  criarCategoria,
  renomearCategoria,
  desativarCategoria,
  criarSubcategoria,
  renomearSubcategoria,
  desativarSubcategoria,
  resolverCategoria,
  resolverSubcategoria,
};
