const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Baixa um arquivo de áudio e salva temporariamente.
 */
function baixarAudio(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const tmpPath = path.join(require('os').tmpdir(), `audio_${Date.now()}.ogg`);
    const file = fs.createWriteStream(tmpPath);

    proto.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(tmpPath); });
    }).on('error', (err) => {
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
  });
}

/**
 * Transcreve áudio usando Whisper.
 * @param {string} audioUrl - URL pública do áudio (ogg, mp3, wav, m4a)
 * @returns {string} texto transcrito
 */
async function transcreverAudio(audioUrl) {
  console.log(`[${new Date().toISOString()}] [Whisper] Baixando áudio: ${audioUrl.substring(0, 60)}...`);

  const tmpPath = await baixarAudio(audioUrl);

  try {
    console.log(`[${new Date().toISOString()}] [Whisper] Enviando para transcrição...`);

    const transcricao = await client.audio.transcriptions.create({
      model: process.env.OPENAI_MODEL_AUDIO || 'whisper-1',
      file: fs.createReadStream(tmpPath),
      language: 'pt',
      response_format: 'text',
    });

    const texto = typeof transcricao === 'string' ? transcricao : transcricao.text;
    console.log(`[${new Date().toISOString()}] [Whisper] Transcrição: "${texto.substring(0, 80)}"`);
    return texto;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

module.exports = { transcreverAudio };
