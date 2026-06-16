const prisma = require('./prisma');

/**
 * Retorna o usuário ativo pelo telefone normalizado, ou null.
 * Telefone deve estar no formato internacional sem '+' (ex: 5511999999999).
 */
async function identificarUsuario(telefone) {
  return prisma.usuario.findFirst({
    where: { telefone, ativo: true },
  });
}

async function adicionarUsuario({ nome, telefone, perfil = 'OPERADOR' }) {
  if (!nome || !telefone) throw new Error('nome e telefone são obrigatórios');

  const tel = String(telefone).replace(/\D/g, '');
  if (tel.length < 10) throw new Error('Telefone inválido — mínimo 10 dígitos');

  return prisma.usuario.upsert({
    where: { telefone: tel },
    update: { nome, perfil, ativo: true },
    create: { nome, telefone: tel, perfil },
  });
}

async function atualizarUsuario(id, { nome, telefone, perfil }) {
  const data = {};
  if (nome !== undefined) data.nome = nome;
  if (telefone !== undefined) data.telefone = String(telefone).replace(/\D/g, '');
  if (perfil !== undefined) data.perfil = perfil;

  if (Object.keys(data).length === 0) {
    throw new Error('Nenhum campo para atualizar');
  }

  return prisma.usuario.update({
    where: { id: Number(id) },
    data,
  });
}

/** Soft delete por ID — nunca remove o registro do banco. */
async function removerUsuarioPorId(id) {
  return prisma.usuario.update({
    where: { id: Number(id) },
    data: { ativo: false },
  });
}

/** Mantido para compatibilidade com o webhook (identificação por telefone). */
async function removerUsuario(telefone) {
  const tel = String(telefone).replace(/\D/g, '');
  return prisma.usuario.update({
    where: { telefone: tel },
    data: { ativo: false },
  });
}

async function listarUsuarios() {
  return prisma.usuario.findMany({
    where: { ativo: true },
    select: {
      id: true, nome: true, telefone: true,
      perfil: true, primeiroAcesso: true, criadoEm: true,
    },
    orderBy: { criadoEm: 'asc' },
  });
}

async function buscarUsuarioPorId(id) {
  return prisma.usuario.findUnique({ where: { id: Number(id) } });
}

module.exports = {
  identificarUsuario,
  adicionarUsuario,
  atualizarUsuario,
  removerUsuario,
  removerUsuarioPorId,
  listarUsuarios,
  buscarUsuarioPorId,
};
