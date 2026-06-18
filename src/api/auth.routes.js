const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const { autenticar } = require('./middlewares/auth');
const { limiterLogin } = require('./middlewares/rateLimiter');

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { telefone, pin }
 *
 * PIN inicial = últimos 4 dígitos do telefone (ex: tel 5511944508585 → pin "8585").
 * Após o primeiro acesso, usa o hash bcrypt armazenado.
 */
router.post('/login', limiterLogin, async (req, res) => {
  try {
    const { telefone, pin } = req.body;

    if (!telefone || !pin) {
      return res.status(400).json({ erro: 'telefone e pin são obrigatórios' });
    }

    const tel = String(telefone).replace(/\D/g, '');
    if (tel.length < 10 || tel.length > 15) {
      return res.status(400).json({ erro: 'Telefone inválido' });
    }
    const pinStr = String(pin).replace(/\D/g, '');
    if (pinStr.length < 4 || pinStr.length > 8) {
      return res.status(400).json({ erro: 'PIN deve ter entre 4 e 8 dígitos' });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { telefone: tel, ativo: true },
    });

    // Resposta genérica para não revelar se o número existe
    if (!usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    let pinValido = false;

    if (usuario.primeiroAcesso || !usuario.pin) {
      // PIN inicial = últimos 4 dígitos do telefone
      pinValido = pinStr === tel.slice(-4);
    } else {
      pinValido = await bcrypt.compare(pinStr, usuario.pin);
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
  } catch (err) {
    console.error('[Auth] Erro no login:', err.message);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  }
});

/**
 * POST /api/auth/trocar-pin
 * Header: Authorization: Bearer {token}
 * Body: { pinAtual, pinNovo }
 */
router.post('/trocar-pin', autenticar, async (req, res) => {
  try {
    const { pinAtual, pinNovo } = req.body;

    if (!pinAtual || !pinNovo) {
      return res.status(400).json({ erro: 'pinAtual e pinNovo são obrigatórios' });
    }

    const pinAtualStr = String(pinAtual).replace(/\D/g, '');
    const pinNovoStr = String(pinNovo).replace(/\D/g, '');

    if (pinNovoStr.length < 4 || pinNovoStr.length > 8) {
      return res.status(400).json({ erro: 'O novo PIN deve ter entre 4 e 8 dígitos' });
    }
    if (pinAtualStr === pinNovoStr) {
      return res.status(400).json({ erro: 'O novo PIN deve ser diferente do atual' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    let pinAtualValido = false;
    if (usuario.primeiroAcesso || !usuario.pin) {
      pinAtualValido = pinAtualStr === usuario.telefone.slice(-4);
    } else {
      pinAtualValido = await bcrypt.compare(pinAtualStr, usuario.pin);
    }

    if (!pinAtualValido) {
      return res.status(401).json({ erro: 'PIN atual incorreto' });
    }

    const hash = await bcrypt.hash(pinNovoStr, 12);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { pin: hash, primeiroAcesso: false },
    });

    return res.json({ ok: true, mensagem: 'PIN atualizado com sucesso' });
  } catch (err) {
    console.error('[Auth] Erro ao trocar PIN:', err.message);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  }
});

/**
 * GET /api/auth/me
 * Retorna os dados do usuário autenticado.
 */
router.get('/me', autenticar, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nome: true, telefone: true, perfil: true, primeiroAcesso: true },
    });
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    return res.json(usuario);
  } catch (err) {
    console.error('[Auth] Erro em /me:', err.message);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  }
});

module.exports = router;
