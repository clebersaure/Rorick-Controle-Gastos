const express = require('express');
const { autenticar, apenasAdmin } = require('./middlewares/auth');
const prisma = require('../db/prisma');

const router = express.Router();

/** GET /api/obras */
router.get('/', autenticar, async (req, res) => {
  try {
    const obras = await prisma.obra.findMany({ where: { ativo: true }, orderBy: { codigo: 'asc' } });
    res.json(obras);
  } catch (err) {
    console.error('[Obras] Erro ao listar:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar obras.' });
  }
});

/** POST /api/obras */
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { codigo, nome } = req.body;

    if (!codigo?.trim() || !nome?.trim()) {
      return res.status(400).json({ erro: 'codigo e nome são obrigatórios' });
    }
    if (String(codigo).trim().length > 30) {
      return res.status(400).json({ erro: 'codigo muito longo (máx. 30 caracteres)' });
    }
    if (String(nome).trim().length > 150) {
      return res.status(400).json({ erro: 'nome muito longo (máx. 150 caracteres)' });
    }

    const codigoNorm = codigo.trim().toUpperCase();

    // Se já existe (mesmo desativada), reativa ao invés de criar duplicata
    const obra = await prisma.obra.upsert({
      where: { codigo: codigoNorm },
      update: { nome: nome.trim(), ativo: true },
      create: { codigo: codigoNorm, nome: nome.trim() },
    });

    res.status(201).json(obra);
  } catch (err) {
    console.error('[Obras] Erro ao criar:', err.message);
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Código de obra já existe' });
    res.status(500).json({ erro: 'Erro ao criar obra.' });
  }
});

/** DELETE /api/obras/:codigo */
router.delete('/:codigo', autenticar, apenasAdmin, async (req, res) => {
  try {
    const codigoNorm = req.params.codigo.toUpperCase();
    await prisma.obra.update({
      where: { codigo: codigoNorm },
      data: { ativo: false },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Obras] Erro ao deletar:', err.message);
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Obra não encontrada' });
    res.status(500).json({ erro: 'Erro ao desativar obra.' });
  }
});

module.exports = router;
