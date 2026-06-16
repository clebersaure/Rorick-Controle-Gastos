// Prefixo 'mock' permite que jest.mock acesse a variável mesmo com hoisting
const mockTranscriptionCreate = jest.fn().mockResolvedValue(
  'gastei oitenta reais no almoço no restaurante da esquina'
);

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: mockTranscriptionCreate } },
  }))
);

jest.mock('axios');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  createReadStream: jest.fn(() => ({})),
  unlink: jest.fn((p, cb) => cb && cb()),
}));

const axios = require('axios');
const fs = require('fs');
const { transcreverAudio } = require('../src/ai/whisper');

beforeEach(() => {
  axios.get.mockReset();
  fs.writeFileSync.mockReset();
  fs.unlink.mockReset();
  mockTranscriptionCreate.mockReset();

  axios.get.mockResolvedValue({ data: Buffer.from('audio-fake-bytes') });
  fs.unlink.mockImplementation((p, cb) => cb && cb());
  mockTranscriptionCreate.mockResolvedValue('gastei oitenta reais no almoço no restaurante da esquina');
});

describe('whisper.js — transcreverAudio', () => {
  test('chama axios.get com responseType arraybuffer', async () => {
    await transcreverAudio('https://cdn.zapi.io/audio/test.ogg');

    expect(axios.get).toHaveBeenCalledWith(
      'https://cdn.zapi.io/audio/test.ogg',
      expect.objectContaining({ responseType: 'arraybuffer' })
    );
  });

  test('salva o buffer em arquivo temporário com sufixo .ogg', async () => {
    await transcreverAudio('https://cdn.zapi.io/audio/test.ogg');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/audio_\d+\.ogg$/),
      expect.any(Buffer)
    );
  });

  test('retorna o texto transcrito como string não vazia', async () => {
    const texto = await transcreverAudio('https://cdn.zapi.io/audio/test.ogg');

    expect(typeof texto).toBe('string');
    expect(texto.length).toBeGreaterThan(0);
    expect(texto).toContain('oitenta reais');
  });

  test('deleta o arquivo temporário após a transcrição bem-sucedida', async () => {
    await transcreverAudio('https://cdn.zapi.io/audio/test.ogg');

    expect(fs.unlink).toHaveBeenCalledWith(
      expect.stringMatching(/audio_\d+\.ogg$/),
      expect.any(Function)
    );
  });

  test('deleta o arquivo temporário mesmo quando a transcrição falha', async () => {
    mockTranscriptionCreate.mockRejectedValueOnce(new Error('OpenAI indisponível'));

    await expect(transcreverAudio('https://cdn.zapi.io/audio/test.ogg'))
      .rejects.toThrow('OpenAI indisponível');

    expect(fs.unlink).toHaveBeenCalled();
  });

  test('envia language pt ao Whisper', async () => {
    await transcreverAudio('https://cdn.zapi.io/audio/test.ogg');

    expect(mockTranscriptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'pt' })
    );
  });
});
