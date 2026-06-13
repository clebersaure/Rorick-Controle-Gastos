const { identificarUsuario } = require('../db/usuarios');
const { processarMensagem } = require('./processador');
const { enviarTexto, notificarAdmins } = require('./sender');
const prisma = require('../db/prisma');

/**
 * Normaliza o telefone recebido do Z-API para o formato sem '+' e sem caracteres especiais.
 * Ex: "+55 11 99999-9999" → "5511999999999"
 */
function normalizarTelefone(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/**
 * Extrai o tipo e conteúdo relevante do payload do Z-API.
 * Retorna null se for mensagem de grupo ou de saída (fromMe).
 */
function extrairMensagem(payload) {
  // Ignora mensagens de grupos e mensagens enviadas pelo próprio bot
  if (payload.isGroup || payload.fromMe) return null;

  const phone = normalizarTelefone(payload.phone || payload.from);

  if (payload.type === 'image' || payload.image) {
    return {
      telefone: phone,
      tipo: 'FOTO',
      conteudo: { imagemUrl: payload.image?.imageUrl || payload.imageUrl },
    };
  }

  if (payload.type === 'audio' || payload.audio || payload.type === 'ptt') {
    return {
      telefone: phone,
      tipo: 'AUDIO',
      conteudo: { audioUrl: payload.audio?.audioUrl || payload.audioUrl },
    };
  }

  if (payload.type === 'text' || payload.text) {
    const texto = payload.text?.message || payload.text || payload.body || '';
    if (!texto.trim()) return null;
    return {
      telefone: phone,
      tipo: 'TEXTO',
      conteudo: { texto: texto.trim() },
    };
  }

  return null;
}

/**
 * Handler principal do webhook do Z-API.
 * Chamado pelo Express em POST /webhook/whatsapp.
 */
async function handleWebhook(req, res) {
  // Responde imediatamente para evitar timeout do Z-API
  res.status(200).json({ ok: true });

  const payload = req.body;
  console.log(`[${new Date().toISOString()}] [Webhook] Payload recebido: type=${payload?.type}, phone=${payload?.phone || payload?.from}`);

  const msg = extrairMensagem(payload);
  if (!msg) {
    console.log(`[${new Date().toISOString()}] [Webhook] Mensagem ignorada (grupo, fromMe ou tipo não suportado)`);
    return;
  }

  const { telefone, tipo, conteudo } = msg;

  // Identifica o usuário pelo número cadastrado
  const usuario = await identificarUsuario(telefone).catch(() => null);

  if (!usuario) {
    console.warn(`[${new Date().toISOString()}] [Webhook] Número não cadastrado: ${telefone}`);

    await enviarTexto(
      telefone,
      '⛔ Seu número não está cadastrado no sistema da Rorick Engenharia.\nEntre em contato com o administrador.'
    ).catch(() => {});

    // Notifica admins sobre tentativa de acesso
    const admins = await prisma.usuario.findMany({ where: { perfil: 'ADMIN', ativo: true } }).catch(() => []);
    await notificarAdmins(admins, `⚠️ Tentativa de acesso de número não cadastrado: ${telefone}`).catch(() => {});

    return;
  }

  // Processa a mensagem com o fluxo principal
  await processarMensagem({ telefone, tipo, conteudo, usuario }).catch(async (err) => {
    console.error(`[${new Date().toISOString()}] [Webhook] Erro não tratado ao processar mensagem de ${telefone}:`, err);
    await enviarTexto(telefone, '❌ Erro interno. Tente novamente em instantes.').catch(() => {});
  });
}

module.exports = { handleWebhook };
