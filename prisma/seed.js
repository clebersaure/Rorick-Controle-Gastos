const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Estrutura extraída da planilha Discovery.xlsx da Rorick Engenharia
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
  {
    nome: 'Ferramentas',
    subcategorias: ['Ferramentas'],
  },
  {
    nome: 'Documentação',
    subcategorias: ['Plotagem', 'ASO', 'Certificados', 'Impostos'],
  },
  {
    nome: 'EPI',
    subcategorias: ['EPI'],
  },
  {
    nome: 'Alimentação',
    subcategorias: ['Café da manhã', 'Almoço', 'Janta'],
  },
  {
    nome: 'Combustível',
    subcategorias: ['Savero - 01', 'Savero - 02', 'Voyage - 03'],
  },
  {
    nome: 'Hospedagem',
    subcategorias: ['Mão de Obra', 'Supervisão'],
  },
  {
    nome: 'Mão de Obra',
    subcategorias: ['Mão de Obra'],
  },
  {
    nome: 'Supervisão',
    subcategorias: ['Café da manhã', 'Almoço', 'Janta', 'Estacionamento', 'Transporte', 'Pedágio', 'Outros'],
  },
  {
    nome: 'Terceiros',
    subcategorias: ['Terceiros'],
  },
];

const USUARIOS_INICIAIS = [
  { nome: 'Rosane', telefone: '5511944504411', perfil: 'ADMIN' },
  { nome: 'Erick', telefone: '5511944508585', perfil: 'ADMIN' },
  { nome: 'Funcionário', telefone: '5511973535055', perfil: 'OPERADOR' },
];

async function main() {
  console.log('[seed] Iniciando seed do banco de dados...');

  for (const cat of CATEGORIAS) {
    const categoria = await prisma.categoria.upsert({
      where: { nome: cat.nome },
      update: {},
      create: { nome: cat.nome },
    });

    for (const sub of cat.subcategorias) {
      await prisma.subcategoria.upsert({
        where: { nome_categoriaId: { nome: sub, categoriaId: categoria.id } },
        update: {},
        create: { nome: sub, categoriaId: categoria.id },
      });
    }
    console.log(`[seed] Categoria "${cat.nome}" com ${cat.subcategorias.length} subcategorias`);
  }

  for (const u of USUARIOS_INICIAIS) {
    await prisma.usuario.upsert({
      where: { telefone: u.telefone },
      update: {},
      create: u,
    });
    console.log(`[seed] Usuário "${u.nome}" (${u.perfil}) criado`);
  }

  console.log('[seed] Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('[seed] Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
