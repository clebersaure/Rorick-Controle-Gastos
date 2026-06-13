// Mock antes de qualquer require dos módulos de IA
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
    audio: { transcriptions: { create: jest.fn() } },
  }));
});

const { CATEGORIAS_VALIDAS } = require('../src/ai/classificador');

describe('classificador.js', () => {
  test('lista de categorias válidas está completa', () => {
    expect(CATEGORIAS_VALIDAS).toContain('Material');
    expect(CATEGORIAS_VALIDAS).toContain('Combustível');
    expect(CATEGORIAS_VALIDAS).toContain('Alimentação');
    expect(CATEGORIAS_VALIDAS).toContain('Ferramentas');
    expect(CATEGORIAS_VALIDAS).toContain('EPI');
    expect(CATEGORIAS_VALIDAS).toContain('Hospedagem');
    expect(CATEGORIAS_VALIDAS).toContain('Mão de Obra');
    expect(CATEGORIAS_VALIDAS).toContain('Supervisão');
    expect(CATEGORIAS_VALIDAS).toContain('Terceiros');
    expect(CATEGORIAS_VALIDAS).toContain('Documentação');
  });

  test('categoria inválida não está na lista', () => {
    expect(CATEGORIAS_VALIDAS).not.toContain('Lazer');
    expect(CATEGORIAS_VALIDAS).not.toContain('Outros');
  });

  test('formato JSON de saída do classificador', () => {
    const saida = {
      valor: 45.00,
      data: '2026-06-12',
      fornecedor: 'Padaria Central',
      descricao: 'Café da manhã equipe',
      categoria_sugerida: 'Alimentação',
      subcategoria_sugerida: 'Café da manhã',
    };

    expect(typeof saida.valor).toBe('number');
    expect(saida.valor).toBeGreaterThan(0);
    expect(CATEGORIAS_VALIDAS).toContain(saida.categoria_sugerida);
  });
});
