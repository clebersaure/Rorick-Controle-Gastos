require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

function criarPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Singleton para evitar múltiplas conexões em desenvolvimento (hot-reload)
const prisma = global._prisma ?? criarPrisma();

if (process.env.NODE_ENV !== 'production') global._prisma = prisma;

module.exports = prisma;
