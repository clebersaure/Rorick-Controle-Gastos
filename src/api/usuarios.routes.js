const express = require('express');
const { autenticarAdmin } = require('./middlewares/auth');
const {
  listarUsuarios,
  adicionarUsuario,
  atualizarUsuario,
  removerUsuarioPorId,
} = require('../db/usuarios');

const router = express.Router();

router.use(autenticarAdmin);

/** Valida que o telefone tem entre 10 e 15 dígitos numéricos. */
function validarTelefone(tel) {
  const normalizado = String(tel).replace(/\D/g, '');
  return normalizado.length >= 10 && normalizado.length <= 15 ? normalizado : null;
}

/** Sanitiza mensagens de erro do Prisma para não vazar schema interno. */
function sanitizarErroPrisma(err) {
  if (err.code === 'P2002') return 'Telefone já cadastrado no sistema';
  if (err.code === 'P2025') return 'Usuário não encontrado';
  return 'Operação inválida';
}

/** GET /api/usuarios */
router.get('/', async (req, res) => {
  try {
    const usuarios = await listarUsuarios();
    res.json(usuarios);
  } catch (err) {
    console.error('[Usuarios] Erro ao listar:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar usuários.' });
  }
});

/** POST /api/usuarios */
router.post('/', async (req, res) => {
  try {
    const { nome, telefone, perfil } = req.body;

    if (!nome?.trim() || !telefone) {
      return res.status(400).json({ erro: 'nome e telefone são obrigatórios' });
    }
    if (String(nome).trim().length > 100) {
      return res.status(400).json({ erro: 'nome muito longo (máx. 100 caracteres)' });
    }

    const telNormalizado = validarTelefone(telefone);
    if (!telNormalizado) {
      return res.status(400).json({ erro: 'Telefone inválido (use apenas dígitos, entre 10 e 15)' });
    }

    const perfilValido = ['ADMIN', 'OPERADOR'];
    if (perfil && !perfilValido.includes(perfil)) {
      return res.status(400).json({ erro: `perfil deve ser um de: ${perfilValido.join(', ')}` });
    }

    const usuario = await adicionarUsuario({ nome: nome.trim(), telefone: telNormalizado, perfil });
    res.status(201).json(usuario);
  } catch (err) {
    console.error('[Usuarios] Erro ao criar:', err.message);
    if (err.code?.startsWith('P')) {
      return res.status(400).json({ erro: sanitizarErroPrisma(err) });
    }
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

/** PATCH /api/usuarios/:id */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, telefone, perfil } = req.body;

    const perfilValido = ['ADMIN', 'OPERADOR'];
    if (perfil && !perfilValido.includes(perfil)) {
      return res.status(400).json({ erro: `perfil deve ser um de: ${perfilValido.join(', ')}` });
    }

    if (String(req.usuario.id) === String(id) && perfil === 'OPERADOR') {
      return res.status(400).json({ erro: 'Você não pode rebaixar seu próprio perfil' });
    }

    let telNormalizado;
    if (telefone !== undefined) {
      telNormalizado = validarTelefone(telefone);
      if (!telNormalizado) {
        return res.status(400).json({ erro: 'Telefone inválido (use apenas dígitos, entre 10 e 15)' });
      }
    }

    const campos = {};
    if (nome?.trim()) campos.nome = nome.trim().substring(0, 100);
    if (telNormalizado) campos.telefone = telNormalizado;
    if (perfil) campos.perfil = perfil;

    const usuario = await atualizarUsuario(id, campos);
    res.json(usuario);
  } catch (err) {
    console.error('[Usuarios] Erro ao atualizar:', err.message);
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (err.code?.startsWith('P')) return res.status(400).json({ erro: sanitizarErroPrisma(err) });
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
});

/** DELETE /api/usuarios/:id */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.usuario.id) === String(id)) {
      return res.status(400).json({ erro: 'Você não pode desativar sua própria conta' });
    }

    await removerUsuarioPorId(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Usuarios] Erro ao remover:', err.message);
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.status(500).json({ erro: 'Erro ao desativar usuário.' });
  }
});

module.exports = router;
