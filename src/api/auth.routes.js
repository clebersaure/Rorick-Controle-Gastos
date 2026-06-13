const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

const router = express.Router();

// Login por telefone — somente ADMINs acessam o dashboard
router.post('/login', async (req, res) => {
  const { telefone } = req.body;

  if (!telefone) {
    return res.status(400).json({ erro: 'Telefone é obrigatório' });
  }

  const tel = String(telefone).replace(/\D/g, '');

  const usuario = await prisma.usuario.findFirst({
    where: { telefone: tel, ativo: true, perfil: 'ADMIN' },
  });

  if (!usuario) {
    return res.status(401).json({ erro: 'Acesso não autorizado. Somente administradores podem acessar o dashboard.' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil } });
});

module.exports = router;
