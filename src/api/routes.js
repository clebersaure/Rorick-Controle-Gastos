const express = require('express');
const authRoutes = require('./auth.routes');
const gastosRoutes = require('./gastos.routes');
const usuariosRoutes = require('./usuarios.routes');
const categoriasRoutes = require('./categorias.routes');
const obrasRoutes = require('./obras.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/gastos', gastosRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/categorias', categoriasRoutes);
router.use('/obras', obrasRoutes);

// Mapa de rotas disponíveis — útil durante desenvolvimento
router.get('/', (req, res) => {
  res.json({
    rotas: [
      'POST   /api/auth/login',
      'POST   /api/auth/trocar-pin',
      'GET    /api/auth/me',
      'GET    /api/gastos',
      'GET    /api/gastos/resumo-mensal',
      'GET    /api/gastos/resumo-categorias',
      'POST   /api/gastos/upload',
      'POST   /api/gastos/confirmar',
      'GET    /api/usuarios',
      'POST   /api/usuarios',
      'PATCH  /api/usuarios/:id',
      'DELETE /api/usuarios/:id',
      'GET    /api/categorias',
      'POST   /api/categorias',
      'PATCH  /api/categorias/:id',
      'DELETE /api/categorias/:id',
      'POST   /api/categorias/:id/subcategorias',
      'PATCH  /api/categorias/:id/subcategorias/:subId',
      'DELETE /api/categorias/:id/subcategorias/:subId',
      'GET    /api/obras',
      'POST   /api/obras',
      'DELETE /api/obras/:codigo',
    ],
  });
});

module.exports = router;
