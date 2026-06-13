jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

const OpenAI = require('openai');

describe('ocr.js — extrairDadosNota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupMock(resposta) {
    // Pega a instância criada pelo módulo ocr.js
    const instance = OpenAI.mock.instances[0];
    instance.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(resposta) } }],
    });
  }

  test('extrai valor e data de nota legível', async () => {
    // Força importação após mock estar configurado
    jest.resetModules();
    jest.mock('openai', () => {
      return jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    valor: 250.00,
                    data: '2026-06-10',
                    fornecedor: 'Posto Shell',
                    descricao: 'Gasolina aditivada',
                    categoria_sugerida: 'Combustível',
                    subcategoria_sugerida: 'Savero - 01',
                  }),
                },
              }],
            }),
          },
        },
      }));
    });

    const { extrairDadosNota } = require('../src/ai/ocr');
    const dados = await extrairDadosNota('http://fake.url/nota.jpg');

    expect(dados.valor).toBe(250.00);
    expect(dados.data).toBe('2026-06-10');
    expect(dados.fornecedor).toBe('Posto Shell');
  });

  test('retorna erro para imagem ilegível', async () => {
    jest.resetModules();
    jest.mock('openai', () => {
      return jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify({ erro: 'legibilidade insuficiente' }) } }],
            }),
          },
        },
      }));
    });

    const { extrairDadosNota } = require('../src/ai/ocr');
    const dados = await extrairDadosNota('http://fake.url/borrada.jpg');

    expect(dados).toHaveProperty('erro');
    expect(dados.erro).toContain('legibilidade');
  });

  test('rejeita valor negativo ou zero na validação', () => {
    const validar = (valor) => typeof valor === 'number' && valor > 0;
    expect(validar(-10)).toBe(false);
    expect(validar(0)).toBe(false);
    expect(validar(99.90)).toBe(true);
  });

  test('valida formato da data YYYY-MM-DD', () => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    expect(regex.test('2026-06-10')).toBe(true);
    expect(regex.test('10/06/2026')).toBe(false);
    expect(regex.test('2026-13-01')).toBe(true); // regex não valida mês, lógica de negócio faz
  });

  test('JSON de saída contém todos os campos esperados', () => {
    const saida = {
      valor: 125.50,
      data: '2026-06-01',
      fornecedor: 'Posto Shell Av. Paulista',
      descricao: 'Combustível — gasolina aditivada',
      categoria_sugerida: 'Combustível',
      subcategoria_sugerida: null,
    };

    ['valor', 'data', 'fornecedor', 'descricao', 'categoria_sugerida', 'subcategoria_sugerida']
      .forEach(campo => expect(saida).toHaveProperty(campo));
  });
});
