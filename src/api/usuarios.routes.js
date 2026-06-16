const express = require('express');
const { autenticarAdmin } = require('./middlewares/auth');
const {
  listarUsuarios,
  adicionarUsuario,
  atualizarUsuario,
  removerUsuarioPorId,
  buscarUsuarioPorId,
} = require('../db/usuarios');

const router = express.Router();

// Todas as rotas exigem autenticação de ADMIN
router.use(autenticarAdmin);

/** GET /api/usuarios — lista todos os usuários ativos */
router.get('/', async (req, res) => {
  const usuarios = await listarUsuarios();
  res.json(usuarios);
});

/** POST /api/usuarios — cria novo usuário */
router.post('/', async (req, res) => {
  const { nome, telefone, perfil } = req.body;

  if (!nome || !telefone) {
    return res.status(400).json({ erro: 'nome e telefone são obrigatórios' });
  }

  const perfilValido = ['ADMIN', 'OPERADOR'];
  if (perfil && !perfilValido.includes(perfil)) {
    return res.status(400).json({ erro: `perfil deve ser um de: ${perfilValido.join(', ')}` });
  }

  try {
    const usuario = await adicionarUsuario({ nome, telefone, perfil });
    res.status(201).json(usuario);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

/** PATCH /api/usuarios/:id — atualiza nome, telefone ou perfil */
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, telefone, perfil } = req.body;

  const perfilValido = ['ADMIN', 'OPERADOR'];
  if (perfil && !perfilValido.includes(perfil)) {
    return res.status(400).json({ erro: `perfil deve ser um de: ${perfilValido.join(', ')}` });
  }

  // Impede que o admin remova o próprio perfil de ADMIN
  if (String(req.usuario.id) === String(id) && perfil === 'OPERADOR') {
    return res.status(400).json({ erro: 'Você não pode rebaixar seu próprio perfil' });
  }

  try {
    const usuario = await atualizarUsuario(id, { nome, telefone, perfil });
    res.json(usuario);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.status(400).json({ erro: err.message });
  }
});

/** DELETE /api/usuarios/:id — soft delete (ativo = false) */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Admin não pode se auto-deletar
  if (String(req.usuario.id) === String(id)) {
    return res.status(400).json({ erro: 'Você não pode desativar sua própria conta' });
  }

  try {
    await removerUsuarioPorId(id);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.status(400).json({ erro: err.message });
  }
});

module.exports = router;
