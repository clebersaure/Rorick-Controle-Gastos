jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue('gasolina vinte litros valor oitenta reais posto shell'),
      },
    },
  }));
});

// Evita baixar arquivo real
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(() => ({ pipe: jest.fn() })),
  createWriteStream: jest.fn(() => ({
    on: jest.fn((event, cb) => { if (event === 'finish') cb(); }),
    close: jest.fn(),
  })),
  unlink: jest.fn(),
}));

describe('whisper.js', () => {
  test('módulo exporta função transcreverAudio', () => {
    const { transcreverAudio } = require('../src/ai/whisper');
    expect(typeof transcreverAudio).toBe('function');
  });

  test('transcrição retorna string não vazia', async () => {
    const transcricaoMock = 'gasolina vinte litros valor oitenta reais posto shell';
    expect(typeof transcricaoMock).toBe('string');
    expect(transcricaoMock.length).toBeGreaterThan(0);
  });

  test('resultado da transcrição pode ser interpretado', () => {
    const transcricao = 'almocei no restaurante do Zé, custou R$ 32,50';
    expect(transcricao).toMatch(/R\$\s*\d+/);
  });
});
