const jwt = require('jsonwebtoken');

/**
 * Verifica o token JWT em Authorization: Bearer {token}.
 * 401 se ausente ou inválido. Injeta req.usuario com o payload decodificado.
 */
function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const expirado = err.name === 'TokenExpiredError';
    return res.status(401).json({ erro: expirado ? 'Token expirado' : 'Token inválido' });
  }
}

/**
 * Rejeita com 403 se o usuário autenticado não for ADMIN.
 * Deve ser usado após autenticar().
 */
function apenasAdmin(req, res, next) {
  if (req.usuario?.perfil !== 'ADMIN') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  }
  next();
}

/** Combinação de autenticar + apenasAdmin — atalho para rotas exclusivas de admin. */
function autenticarAdmin(req, res, next) {
  autenticar(req, res, () => apenasAdmin(req, res, next));
}

module.exports = { autenticar, apenasAdmin, autenticarAdmin };
