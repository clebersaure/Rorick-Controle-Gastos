const express = require('express');
const { autenticar, autenticarAdmin } = require('./middlewares/auth');
const {
  listarCategorias,
  criarCategoria,
  renomearCategoria,
  desativarCategoria,
  criarSubcategoria,
  renomearSubcategoria,
  desativarSubcategoria,
} = require('../db/categorias');

const router = express.Router();

/** GET /api/categorias — leitura disponível para qualquer usuário autenticado */
router.get('/', autenticar, async (req, res) => {
  const categorias = await listarCategorias();
  res.json(categorias);
});

/** POST /api/categorias — cria nova categoria (admin) */
router.post('/', autenticarAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'nome é obrigatório' });

  try {
    const cat = await criarCategoria(nome.trim());
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

/** PATCH /api/categorias/:id — renomeia categoria (admin) */
router.patch('/:id', autenticarAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'nome é obrigatório' });

  try {
    const cat = await renomearCategoria(req.params.id, nome.trim());
    res.json(cat);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Categoria não encontrada' });
    res.status(400).json({ erro: err.message });
  }
});

/** DELETE /api/categorias/:id — desativa categoria (admin) */
router.delete('/:id', autenticarAdmin, async (req, res) => {
  try {
    await desativarCategoria(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Categoria não encontrada' });
    res.status(400).json({ erro: err.message });
  }
});

// --- Subcategorias ---

/** POST /api/categorias/:id/subcategorias — cria subcategoria (admin) */
router.post('/:id/subcategorias', autenticarAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'nome é obrigatório' });

  try {
    const sub = await criarSubcategoria(nome.trim(), req.params.id);
    res.status(201).json(sub);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

/** PATCH /api/categorias/:id/subcategorias/:subId — renomeia subcategoria (admin) */
router.patch('/:id/subcategorias/:subId', autenticarAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'nome é obrigatório' });

  try {
    const sub = await renomearSubcategoria(req.params.subId, nome.trim());
    res.json(sub);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Subcategoria não encontrada' });
    res.status(400).json({ erro: err.message });
  }
});

/** DELETE /api/categorias/:id/subcategorias/:subId — desativa subcategoria (admin) */
router.delete('/:id/subcategorias/:subId', autenticarAdmin, async (req, res) => {
  try {
    await desativarSubcategoria(req.params.subId);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Subcategoria não encontrada' });
    res.status(400).json({ erro: err.message });
  }
});

module.exports = router;
