// Shared mock function — definida aqui e capturada pelo factory do jest.mock
// O prefixo 'mock' é necessário para o jest permitir acesso cross-scope no hoisting
const mockChatCreate = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
  }))
);

jest.mock('../src/db/prisma', () => ({
  categoria: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
}));

const prisma = require('../src/db/prisma');
const { classificarTexto } = require('../src/ai/classificador');

const CATEGORIAS_MOCK = [
  {
    id: 1, nome: 'Material', ativo: true,
    subcategorias: [{ id: 10, nome: 'Fundação' }, { id: 11, nome: 'Pintura' }],
  },
  {
    id: 2, nome: 'Combustível', ativo: true,
    subcategorias: [{ id: 20, nome: 'Savero - 01' }, { id: 21, nome: 'Savero - 02' }],
  },
  {
    id: 3, nome: 'Alimentação', ativo: true,
    subcategorias: [{ id: 30, nome: 'Almoço' }, { id: 31, nome: 'Café da manhã' }],
  },
];

beforeEach(() => {
  mockChatCreate.mockReset();
  prisma.categoria.findMany.mockReset();
  prisma.categoria.findFirst.mockReset();

  // findMany: chamado para montar o prompt dinâmico com categorias do banco
  prisma.categoria.findMany.mockResolvedValue(CATEGORIAS_MOCK);
});

function setupGpt(payload) {
  mockChatCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  });
}

describe('classificador.js — classificarTexto', () => {
  test('busca categorias ativas do banco para montar o prompt', async () => {
    setupGpt({
      valor: 80.0, data: '2026-06-10', fornecedor: 'Restaurante',
      descricao: 'Almoço', categoria_sugerida: 'Alimentação', subcategoria_sugerida: 'Almoço',
    });
    prisma.categoria.findFirst.mockResolvedValue(CATEGORIAS_MOCK[2]);

    await classificarTexto('almoçei no restaurante, custou 80 reais');

    expect(prisma.categoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true } })
    );
  });

  test('retorna o objeto Categoria do banco correspondente à sugestão do GPT', async () => {
    setupGpt({
      valor: 250.0, data: '2026-06-12', fornecedor: 'Posto Shell',
      descricao: 'Abastecimento', categoria_sugerida: 'Combustível', subcategoria_sugerida: 'Savero - 01',
    });
    prisma.categoria.findFirst.mockResolvedValue(CATEGORIAS_MOCK[1]);

    const { dados, categoria } = await classificarTexto('abasteci o savero 01 com 250 reais');

    expect(categoria).not.toBeNull();
    expect(categoria.nome).toBe('Combustível');
    expect(categoria.id).toBe(2);
  });

  test('retorna categoria null quando GPT não consegue classificar', async () => {
    setupGpt({
      valor: 50.0, data: null, fornecedor: null,
      descricao: 'gasto indefinido', categoria_sugerida: null, subcategoria_sugerida: null,
    });
    prisma.categoria.findFirst.mockResolvedValue(null);

    const { dados, categoria } = await classificarTexto('comprei uma coisa');

    expect(categoria).toBeNull();
    expect(dados.categoria_sugerida).toBeNull();
  });

  test('normaliza data para hoje quando GPT retorna null', async () => {
    setupGpt({
      valor: 30.0, data: null, fornecedor: null,
      descricao: 'café', categoria_sugerida: 'Alimentação', subcategoria_sugerida: 'Café da manhã',
    });
    prisma.categoria.findFirst.mockResolvedValue(CATEGORIAS_MOCK[2]);

    const { dados } = await classificarTexto('café da manhã 30 reais');

    expect(dados.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dados.data).toBe(new Date().toISOString().split('T')[0]);
  });

  test('dados retornados contêm todos os campos esperados', async () => {
    setupGpt({
      valor: 125.50, data: '2026-06-15', fornecedor: 'Depósito ABC',
      descricao: 'cimento e areia', categoria_sugerida: 'Material', subcategoria_sugerida: 'Fundação',
    });
    prisma.categoria.findFirst.mockResolvedValue(CATEGORIAS_MOCK[0]);

    const { dados, categoria } = await classificarTexto('comprei cimento e areia 125,50');

    ['valor', 'data', 'fornecedor', 'descricao', 'categoria_sugerida', 'subcategoria_sugerida']
      .forEach((campo) => expect(dados).toHaveProperty(campo));
    expect(categoria.nome).toBe('Material');
  });

  test('chama GPT com model gpt-4o-mini', async () => {
    setupGpt({
      valor: 10.0, data: '2026-06-01', fornecedor: null,
      descricao: 'café', categoria_sugerida: 'Alimentação', subcategoria_sugerida: null,
    });
    prisma.categoria.findFirst.mockResolvedValue(CATEGORIAS_MOCK[2]);

    await classificarTexto('café');

    const chamada = mockChatCreate.mock.calls[0][0];
    expect(chamada.model).toMatch(/gpt-4o-mini/);
  });
});
