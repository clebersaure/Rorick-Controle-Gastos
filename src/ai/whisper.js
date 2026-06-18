require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { comRetry, erroOpenAITransitorio, erroAxiosTransitorio } = require('../utils/retry');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60_000, // áudio pode ser maior; dá mais margem
  maxRetries: 0,
});

/**
 * Baixa o arquivo de áudio com retry (até 3 tentativas, timeout 30s cada).
 */
async function baixarAudio(url) {
  const tmpPath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);

  await comRetry(
    async () => {
      const resposta = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        headers: { 'User-Agent': 'RorickBot/1.0' },
      });
      fs.writeFileSync(tmpPath, Buffer.from(resposta.data));
    },
    { tentativas: 3, delayMs: 2000, deveRetentar: erroAxiosTransitorio }
  );

  return tmpPath;
}

/**
 * Transcreve áudio usando Whisper-1 com retry em erros transitórios.
 * @param {string} audioUrl - URL pública do áudio enviada pelo Z-API
 * @returns {string} texto transcrito em português
 */
async function transcreverAudio(audioUrl) {
  console.log(`[Whisper] Baixando áudio: ${audioUrl.substring(0, 70)}...`);

  const tmpPath = await baixarAudio(audioUrl);

  try {
    console.log(`[Whisper] Enviando para Whisper-1 (${path.basename(tmpPath)})...`);

    const transcricao = await comRetry(
      () =>
        client.audio.transcriptions.create({
          model: process.env.OPENAI_MODEL_AUDIO || 'whisper-1',
          file: fs.createReadStream(tmpPath),
          language: 'pt',
          response_format: 'text',
        }),
      { tentativas: 3, delayMs: 3000, deveRetentar: erroOpenAITransitorio }
    );

    const texto = (typeof transcricao === 'string' ? transcricao : transcricao.text).trim();
    console.log(`[Whisper] Transcrição concluída: "${texto.substring(0, 100)}"`);
    return texto;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

module.exports = { transcreverAudio };
