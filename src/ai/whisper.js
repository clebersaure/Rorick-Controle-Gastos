require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Baixa o arquivo de áudio da URL do Z-API usando axios (arraybuffer)
 * e salva em /tmp/audio_{timestamp}.ogg.
 * Retorna o caminho do arquivo temporário.
 */
async function baixarAudio(url) {
  const tmpPath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);

  const resposta = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: { 'User-Agent': 'RorickBot/1.0' },
  });

  fs.writeFileSync(tmpPath, Buffer.from(resposta.data));
  return tmpPath;
}

/**
 * Transcreve áudio usando Whisper-1.
 * @param {string} audioUrl - URL pública do áudio enviada pelo Z-API (ogg/mp3/m4a)
 * @returns {string} texto transcrito em português
 */
async function transcreverAudio(audioUrl) {
  console.log(`[${new Date().toISOString()}] [Whisper] Baixando áudio: ${audioUrl.substring(0, 70)}...`);

  const tmpPath = await baixarAudio(audioUrl);

  try {
    console.log(`[${new Date().toISOString()}] [Whisper] Enviando para Whisper-1 (${path.basename(tmpPath)})...`);

    const transcricao = await client.audio.transcriptions.create({
      model: process.env.OPENAI_MODEL_AUDIO || 'whisper-1',
      file: fs.createReadStream(tmpPath),
      language: 'pt',
      response_format: 'text',
    });

    // O SDK pode retornar string direta ou objeto com .text
    const texto = (typeof transcricao === 'string' ? transcricao : transcricao.text).trim();

    console.log(`[${new Date().toISOString()}] [Whisper] Transcrição concluída: "${texto.substring(0, 100)}"`);
    return texto;
  } finally {
    // Garante deleção do arquivo temporário mesmo em caso de erro
    fs.unlink(tmpPath, () => {});
  }
}

module.exports = { transcreverAudio };
