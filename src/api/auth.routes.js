const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const { autenticar } = require('./middlewares/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { telefone, pin }
 *
 * Pin inicial = últimos 4 dígitos do telefone (ex: tel 5511944508585 → pin "8585").
 * Se primeiroAcesso=true e pin bater com o padrão inicial, autentica e sinaliza troca obrigatória.
 * Após o primeiro acesso, usa o hash bcrypt armazenado.
 */
router.post('/login', async (req, res) => {
  const { telefone, pin } = req.body;

  if (!telefone || !pin) {
    return res.status(400).json({ erro: 'telefone e pin são obrigatórios' });
  }

  const tel = String(telefone).replace(/\D/g, '');
  if (tel.length < 10) {
    return res.status(400).json({ erro: 'Telefone inválido' });
  }
  if (String(pin).length < 4) {
    return res.status(400).json({ erro: 'PIN deve ter pelo menos 4 dígitos' });
  }

  const usuario = await prisma.usuario.findFirst({
    where: { telefone: tel, ativo: true, perfil: 'ADMIN' },
  });

  if (!usuario) {
    // Resposta genérica para não revelar se o número existe
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  let pinValido = false;

  if (usuario.primeiroAcesso || !usuario.pin) {
    // PIN inicial = últimos 4 dígitos do telefone
    const pinInicial = tel.slice(-4);
    pinValido = String(pin) === pinInicial;
  } else {
    pinValido = await bcrypt.compare(String(pin), usuario.pin);
  }

  if (!pinValido) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return res.json({
    token,
    primeiroAcesso: usuario.primeiroAcesso,
    usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
  });
});

/**
 * POST /api/auth/trocar-pin
 * Header: Authorization: Bearer {token}
 * Body: { pinAtual, pinNovo }
 *
 * Obrigatório no primeiro acesso. Também disponível para troca voluntária.
 */
router.post('/trocar-pin', autenticar, async (req, res) => {
  const { pinAtual, pinNovo } = req.body;

  if (!pinAtual || !pinNovo) {
    return res.status(400).json({ erro: 'pinAtual e pinNovo são obrigatórios' });
  }
  if (String(pinNovo).length < 4) {
    return res.status(400).json({ erro: 'O novo PIN deve ter pelo menos 4 dígitos' });
  }
  if (String(pinAtual) === String(pinNovo)) {
    return res.status(400).json({ erro: 'O novo PIN deve ser diferente do atual' });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });

  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado' });
  }

  // Valida o PIN atual antes de trocar
  let pinAtualValido = false;
  if (usuario.primeiroAcesso || !usuario.pin) {
    pinAtualValido = String(pinAtual) === usuario.telefone.slice(-4);
  } else {
    pinAtualValido = await bcrypt.compare(String(pinAtual), usuario.pin);
  }

  if (!pinAtualValido) {
    return res.status(401).json({ erro: 'PIN atual incorreto' });
  }

  const hash = await bcrypt.hash(String(pinNovo), 12);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { pin: hash, primeiroAcesso: false },
  });

  return res.json({ ok: true, mensagem: 'PIN atualizado com sucesso' });
});

/**
 * GET /api/auth/me
 * Retorna os dados do usuário autenticado.
 */
router.get('/me', autenticar, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: { id: true, nome: true, telefone: true, perfil: true, primeiroAcesso: true },
  });
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  return res.json(usuario);
});

module.exports = router;
