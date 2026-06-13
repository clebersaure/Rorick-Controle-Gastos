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

module.exports = router;
