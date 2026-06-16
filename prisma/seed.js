require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Estrutura de categorias e subcategorias — extraída do Discovery.xlsx da Rorick Engenharia
const CATEGORIAS = [
  {
    nome: 'Material',
    subcategorias: [
      'Movimentação de solo', 'Sondagem', 'Projeto', 'Canteiro de Obra',
      'Fundação', 'Elevação Alvenaria', 'Laje', 'Cobertura', 'Hidráulica',
      'Elétrica', 'Cabeamento Estruturado', 'Acabamento', 'Escadas',
      'Louças e Metais', 'Piso', 'Forro', 'Pintura',
    ],
  },
  { nome: 'Ferramentas',  subcategorias: ['Ferramentas'] },
  { nome: 'Documentação', subcategorias: ['Plotagem', 'ASO', 'Certificados', 'Impostos'] },
  { nome: 'EPI',          subcategorias: ['EPI'] },
  { nome: 'Alimentação',  subcategorias: ['Café da manhã', 'Almoço', 'Janta'] },
  { nome: 'Combustível',  subcategorias: ['Savero - 01', 'Savero - 02', 'Voyage - 03'] },
  { nome: 'Hospedagem',   subcategorias: ['Mão de Obra', 'Supervisão'] },
  { nome: 'Mão de Obra',  subcategorias: ['Mão de Obra'] },
  {
    nome: 'Supervisão',
    subcategorias: ['Café da manhã', 'Almoço', 'Janta', 'Estacionamento', 'Transporte', 'Pedágio', 'Outros'],
  },
  { nome: 'Terceiros', subcategorias: ['Terceiros'] },
];

/**
 * Usuários iniciais de produção.
 * PIN inicial = últimos 4 dígitos do telefone (ex: 8585).
 * primeiroAcesso=true obriga a troca de PIN no primeiro login.
 *
 * IMPORTANTE: os telefones abaixo são os reais cadastrados no WhatsApp da Rorick.
 * Altere antes de rodar em um novo ambiente.
 */
const USUARIOS_INICIAIS = [
  { nome: 'Rosane',      telefone: '5511944504411', perfil: 'ADMIN' },
  { nome: 'Erick',       telefone: '5511944508585', perfil: 'ADMIN' },
  { nome: 'Cleber',      telefone: '5511983519913', perfil: 'OPERADOR' },
];

async function seedCategorias() {
  for (const cat of CATEGORIAS) {
    const categoria = await prisma.categoria.upsert({
      where: { nome: cat.nome },
      update: { ativo: true },
      create: { nome: cat.nome },
    });

    for (const sub of cat.subcategorias) {
      await prisma.subcategoria.upsert({
        where: { nome_categoriaId: { nome: sub, categoriaId: categoria.id } },
        update: { ativo: true },
        create: { nome: sub, categoriaId: categoria.id },
      });
    }
    console.log(`[seed] ✓ ${cat.nome} (${cat.subcategorias.length} subcategorias)`);
  }
}

async function seedUsuarios() {
  for (const u of USUARIOS_INICIAIS) {
    const tel = u.telefone.replace(/\D/g, '');

    await prisma.usuario.upsert({
      where: { telefone: tel },
      // Se já existe, não sobrescreve PIN nem primeiroAcesso — preserva configuração de prod
      update: { nome: u.nome, perfil: u.perfil, ativo: true },
      create: {
        nome: u.nome,
        telefone: tel,
        perfil: u.perfil,
        primeiroAcesso: true,
        // PIN não é armazenado no seed: o usuário define no primeiro acesso
        // (validação usa os últimos 4 dígitos do telefone como PIN temporário)
      },
    });
    const pinInicial = tel.slice(-4);
    console.log(`[seed] ✓ ${u.nome} (${u.perfil}) — PIN inicial: ${pinInicial}`);
  }
}

async function main() {
  console.log('[seed] Iniciando seed de produção...\n');

  console.log('[seed] → Categorias e subcategorias:');
  await seedCategorias();

  console.log('\n[seed] → Usuários:');
  await seedUsuarios();

  console.log('\n[seed] Seed concluído!');
  console.log('[seed] Lembre os admins de trocar o PIN no primeiro acesso via POST /api/auth/trocar-pin');
}

main()
  .catch((e) => { console.error('[seed] Erro:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
