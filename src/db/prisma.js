const { PrismaClient } = require('@prisma/client');

// Singleton para evitar múltiplas conexões em desenvolvimento (hot-reload)
const prisma = global._prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') global._prisma = prisma;

module.exports = prisma;
