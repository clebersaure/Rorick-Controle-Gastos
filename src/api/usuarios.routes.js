const express = require('express');
const { autenticar, apenasAdmin } = require('./middlewares/auth');
const { listarUsuarios, adicionarUsuario, removerUsuario } = require('../db/usuarios');

const router = express.Router();

router.get('/', autenticar, apenasAdmin, async (req, res) => {
  const usuarios = await listarUsuarios();
  res.json(usuarios);
});

router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { nome, telefone, perfil } = req.body;

  if (!nome || !telefone) {
    return res.status(400).json({ erro: 'nome e telefone são obrigatórios' });
  }

  const usuario = await adicionarUsuario({ nome, telefone, perfil });
  res.status(201).json(usuario);
});

router.delete('/:telefone', autenticar, apenasAdmin, async (req, res) => {
  await removerUsuario(req.params.telefone);
  res.json({ ok: true });
});

module.exports = router;
