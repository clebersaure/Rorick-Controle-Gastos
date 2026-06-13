const express = require('express');
const { autenticar, apenasAdmin } = require('./middlewares/auth');
const { listarCategorias, criarCategoria, criarSubcategoria } = require('../db/categorias');

const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  const categorias = await listarCategorias();
  res.json(categorias);
});

router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome é obrigatório' });
  const cat = await criarCategoria(nome);
  res.status(201).json(cat);
});

router.post('/:id/subcategorias', autenticar, apenasAdmin, async (req, res) => {
  const { nome } = req.body;
  const categoriaId = parseInt(req.params.id);
  if (!nome) return res.status(400).json({ erro: 'nome é obrigatório' });
  const sub = await criarSubcategoria(nome, categoriaId);
  res.status(201).json(sub);
});

module.exports = router;
