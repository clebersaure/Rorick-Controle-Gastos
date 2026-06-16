const mockOcrCreate = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOcrCreate } },
  }))
);

const { extrairDadosNota } = require('../src/ai/ocr');

function setupOcr(payload) {
  mockOcrCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  });
}

beforeEach(() => {
  mockOcrCreate.mockReset();
});

describe('ocr.js — extrairDadosNota', () => {
  test('extrai valor e data de uma nota legível', async () => {
    setupOcr({
      valor: 250.00, data: '2026-06-10', fornecedor: 'Posto Shell',
      descricao: 'Gasolina aditivada', categoria_sugerida: 'Combustível', subcategoria_sugerida: 'Savero - 01',
    });

    const dados = await extrairDadosNota('http://fake.url/nota.jpg');

    expect(dados.valor).toBe(250.00);
    expect(dados.data).toBe('2026-06-10');
    expect(dados.fornecedor).toBe('Posto Shell');
    expect(dados.categoria_sugerida).toBe('Combustível');
  });

  test('retorna { erro } para imagem ilegível', async () => {
    setupOcr({ erro: 'legibilidade insuficiente' });

    const dados = await extrairDadosNota('http://fake.url/borrada.jpg');

    expect(dados).toHaveProperty('erro');
    expect(dados.erro).toContain('legibilidade');
  });

  test('preenche data com hoje quando GPT retorna null', async () => {
    setupOcr({
      valor: 99.0, data: null, fornecedor: null,
      descricao: 'compra', categoria_sugerida: null, subcategoria_sugerida: null,
    });

    const dados = await extrairDadosNota('http://fake.url/nota2.jpg');

    expect(dados.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dados.data).toBe(new Date().toISOString().split('T')[0]);
  });

  test('retorna { erro } quando valor é negativo ou zero', async () => {
    setupOcr({
      valor: -5, data: '2026-06-01', fornecedor: null,
      descricao: null, categoria_sugerida: null, subcategoria_sugerida: null,
    });

    const dados = await extrairDadosNota('http://fake.url/nota3.jpg');

    expect(dados).toHaveProperty('erro');
  });

  test('JSON de saída contém todos os campos obrigatórios', () => {
    const saida = {
      valor: 125.50, data: '2026-06-01',
      fornecedor: 'Posto Shell', descricao: 'Combustível',
      categoria_sugerida: 'Combustível', subcategoria_sugerida: 'Savero - 01',
    };

    ['valor', 'data', 'fornecedor', 'descricao', 'categoria_sugerida', 'subcategoria_sugerida']
      .forEach((campo) => expect(saida).toHaveProperty(campo));
  });
});
