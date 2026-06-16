require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TELEFONE = '5511983519913';
const NOVO_PIN  = '050131';

async function main() {
  const hash = await bcrypt.hash(NOVO_PIN, 12);
  const usuario = await prisma.usuario.update({
    where: { telefone: TELEFONE },
    data: { pin: hash, primeiroAcesso: false },
    select: { id: true, nome: true, telefone: true },
  });
  console.log(`PIN resetado com sucesso para ${usuario.nome} (${usuario.telefone})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
