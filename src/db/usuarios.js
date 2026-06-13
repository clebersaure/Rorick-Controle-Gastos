const prisma = require('./prisma');

/**
 * Retorna o usuário pelo telefone se estiver ativo, ou null caso contrário.
 * O telefone deve estar no formato internacional sem '+' (ex: 5511999999999).
 */
async function identificarUsuario(telefone) {
  return prisma.usuario.findFirst({
    where: { telefone, ativo: true },
  });
}

async function adicionarUsuario({ nome, telefone, perfil = 'OPERADOR' }) {
  if (!nome || !telefone) throw new Error('nome e telefone são obrigatórios');

  const tel = telefone.replace(/\D/g, '');
  if (tel.length < 10) throw new Error('Telefone inválido');

  return prisma.usuario.upsert({
    where: { telefone: tel },
    update: { nome, perfil, ativo: true },
    create: { nome, telefone: tel, perfil },
  });
}

// Soft delete — nunca remove do banco
async function removerUsuario(telefone) {
  const tel = telefone.replace(/\D/g, '');
  return prisma.usuario.update({
    where: { telefone: tel },
    data: { ativo: false },
  });
}

async function listarUsuarios() {
  return prisma.usuario.findMany({
    where: { ativo: true },
    orderBy: { criadoEm: 'asc' },
  });
}

async function buscarUsuarioPorId(id) {
  return prisma.usuario.findUnique({ where: { id } });
}

module.exports = { identificarUsuario, adicionarUsuario, removerUsuario, listarUsuarios, buscarUsuarioPorId };
