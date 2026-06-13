const express = require('express');
const { autenticar, apenasAdmin } = require('./middlewares/auth');
const prisma = require('../db/prisma');

const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  const obras = await prisma.obra.findMany({ where: { ativo: true }, orderBy: { codigo: 'asc' } });
  res.json(obras);
});

router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { codigo, nome } = req.body;
  if (!codigo || !nome) return res.status(400).json({ erro: 'codigo e nome são obrigatórios' });

  const obra = await prisma.obra.upsert({
    where: { codigo: codigo.toUpperCase() },
    update: { nome, ativo: true },
    create: { codigo: codigo.toUpperCase(), nome },
  });
  res.status(201).json(obra);
});

router.delete('/:codigo', autenticar, apenasAdmin, async (req, res) => {
  await prisma.obra.update({
    where: { codigo: req.params.codigo.toUpperCase() },
    data: { ativo: false },
  });
  res.json({ ok: true });
});

module.exports = router;
