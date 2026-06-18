const { extrairDadosNota } = require('../ai/ocr');
const { transcreverAudio } = require('../ai/whisper');
const { classificarTexto } = require('../ai/classificador');
const { salvarGasto } = require('../db/gastos');
const { resolverSubcategoria } = require('../db/categorias');
const { enviarTexto, enviarConfirmacao, enviarSolicitacaoObra } = require('./sender');
const prisma = require('../db/prisma');

// Estado de conversa em memória: telefone → { etapa, dados, categoriaObj, usuarioId }
const estadosConversa = new Map();

// Lock de concorrência: impede processamento simultâneo do mesmo número
// (ex: usuário envia duas fotos em sequência antes de responder)
const emProcessamento = new Set();

const ETAPA = {
  AGUARDANDO_OBRA: 'AGUARDANDO_OBRA',
  AGUARDANDO_CONFIRMACAO: 'AGUARDANDO_CONFIRMACAO',
};

/**
 * Ponto de entrada: processa uma mensagem recebida do WhatsApp.
 * Garante que o mesmo número não seja processado em paralelo.
 */
async function processarMensagem({ telefone, tipo, conteudo, usuario }) {
  // Bloqueia processamento paralelo do mesmo número
  if (emProcessamento.has(telefone)) {
    console.warn(`[Processador] Mensagem de ${telefone} ignorada — processamento anterior ainda em andamento.`);
    await enviarTexto(telefone, '⏳ Ainda estou processando sua mensagem anterior. Aguarde um momento.');
    return;
  }

  emProcessamento.add(telefone);
  try {
    await _processarMensagemInterna({ telefone, tipo, conteudo, usuario });
  } finally {
    emProcessamento.delete(telefone);
  }
}

async function _processarMensagemInterna({ telefone, tipo, conteudo, usuario }) {
  const estado = estadosConversa.get(telefone);

  if (estado) {
    return tratarRespostaConversa(telefone, conteudo, estado, usuario);
  }

  let resultado;

  try {
    if (tipo === 'FOTO') {
      resultado = await processarFoto(conteudo.imagemUrl, telefone);
    } else if (tipo === 'AUDIO') {
      resultado = await processarAudio(conteudo.audioUrl, telefone);
    } else if (tipo === 'TEXTO') {
      resultado = await processarTexto(conteudo.texto, telefone);
    } else {
      await enviarTexto(telefone, '❓ Tipo de mensagem não suportado. Envie uma foto de nota, áudio ou texto descrevendo o gasto.');
      return;
    }
  } catch (err) {
    console.error(`[Processador] Erro ao processar mensagem de ${telefone}:`, err.message);

    // Mensagem específica por tipo de falha
    const msgErro = classificarErroUsuario(err);
    await enviarTexto(telefone, msgErro);
    return;
  }

  const { dados, categoriaObj } = resultado;

  if (!dados || dados.erro) {
    const motivo = dados?.erro || 'não foi possível extrair os dados';
    await enviarTexto(telefone, `⚠️ Não consegui identificar o gasto: ${motivo}.\n\nTente enviar a foto com mais nitidez ou descreva o gasto em texto.`);
    return;
  }

  if (!dados.valor || dados.valor <= 0) {
    await enviarTexto(telefone, '⚠️ Não consegui identificar o *valor* do gasto. Por favor, descreva novamente incluindo o valor. Ex: _"Almoço R$ 45,00"_');
    return;
  }

  estadosConversa.set(telefone, {
    etapa: ETAPA.AGUARDANDO_OBRA,
    dados,
    categoriaObj,
    usuarioId: usuario.id,
  });

  await enviarSolicitacaoObra(telefone);
}

async function tratarRespostaConversa(telefone, conteudo, estado, usuario) {
  const texto = (conteudo.texto || '').trim().toUpperCase();

  if (estado.etapa === ETAPA.AGUARDANDO_OBRA) {
    const codigoObra = (conteudo.texto || '').trim();

    try {
      const obraId = await resolverObra(codigoObra);
      estado.dados.obra = codigoObra.toUpperCase() !== 'GERAL' ? codigoObra.toUpperCase() : null;
      estado.dados.obraId = obraId;
    } catch (err) {
      console.error(`[Processador] Erro ao resolver obra "${codigoObra}":`, err.message);
      await enviarTexto(telefone, '❌ Erro ao buscar a obra. Tente novamente ou digite *GERAL*.');
      return;
    }

    estado.etapa = ETAPA.AGUARDANDO_CONFIRMACAO;
    estadosConversa.set(telefone, estado);

    await enviarConfirmacao(telefone, estado.dados);
    return;
  }

  if (estado.etapa === ETAPA.AGUARDANDO_CONFIRMACAO) {
    if (texto === 'SIM' || texto === 'S') {
      await confirmarGasto(telefone, estado);
    } else if (texto === 'NÃO' || texto === 'NAO' || texto === 'N') {
      estadosConversa.delete(telefone);
      await enviarTexto(telefone, '❌ Registro cancelado. Pode enviar outro gasto quando quiser.');
    } else {
      await enviarTexto(telefone, 'Por favor, responda *SIM* para confirmar ou *NÃO* para cancelar.');
    }
  }
}

async function confirmarGasto(telefone, estado) {
  const { dados, categoriaObj, usuarioId } = estado;

  let categoria = categoriaObj;
  if (!categoria) {
    try {
      categoria = await prisma.categoria.findFirst({
        where: { nome: { contains: dados.categoria_sugerida || 'Material', mode: 'insensitive' }, ativo: true },
      });
    } catch (err) {
      console.error(`[Processador] Erro ao buscar categoria no banco:`, err.message);
      await enviarTexto(telefone, '❌ Erro ao acessar o banco de dados. Tente confirmar novamente em instantes.');
      return;
    }
  }

  if (!categoria) {
    await enviarTexto(telefone, '❌ Categoria não encontrada. Entre em contato com o administrador.');
    estadosConversa.delete(telefone);
    return;
  }

  let subcategoria;
  try {
    subcategoria = await resolverSubcategoria(dados.subcategoria_sugerida, categoria.id);
  } catch (err) {
    console.error(`[Processador] Erro ao resolver subcategoria:`, err.message);
    subcategoria = null; // subcategoria é opcional; segue sem ela
  }

  try {
    const gasto = await salvarGasto({
      valor: dados.valor,
      data: dados.data,
      fornecedor: dados.fornecedor,
      descricao: dados.descricao,
      categoriaId: categoria.id,
      subcategoriaId: subcategoria?.id || null,
      usuarioId,
      obraId: dados.obraId || null,
      imagemUrl: dados.imagemUrl || null,
      fonte: dados.fonte || 'TEXTO',
    });

    console.log(`[Processador] Gasto #${gasto.id} salvo — R$ ${gasto.valor} | cat: ${categoria.nome} | usuário: ${usuarioId}`);

    estadosConversa.delete(telefone);
    await enviarTexto(
      telefone,
      `✅ *Gasto registrado com sucesso!*\n\n🆔 ID: #${gasto.id}\n💰 R$ ${Number(gasto.valor).toFixed(2)}\n🏷️ ${categoria.nome}${subcategoria ? ` › ${subcategoria.nome}` : ''}`
    );
  } catch (err) {
    console.error(`[Processador] Erro ao salvar gasto:`, err.message);

    // Mantém o estado para o usuário poder tentar confirmar novamente
    await enviarTexto(
      telefone,
      '❌ Erro ao salvar o gasto (banco de dados temporariamente indisponível).\n\nO gasto ainda está em memória. Responda *SIM* para tentar novamente ou *NÃO* para cancelar.'
    );
  }
}

// --- Processadores por tipo ---

async function processarFoto(imagemUrl, telefone) {
  console.log(`[Processador] FOTO de ${telefone}`);
  const dados = await extrairDadosNota(imagemUrl);
  if (dados.erro) return { dados, categoriaObj: null };

  dados.imagemUrl = imagemUrl;
  dados.fonte = 'FOTO';

  let categoriaObj = null;
  if (dados.categoria_sugerida) {
    categoriaObj = await prisma.categoria.findFirst({
      where: { nome: { contains: dados.categoria_sugerida, mode: 'insensitive' }, ativo: true },
    });
  }

  return { dados, categoriaObj };
}

async function processarAudio(audioUrl, telefone) {
  console.log(`[Processador] ÁUDIO de ${telefone}`);
  const transcricao = await transcreverAudio(audioUrl);
  const { dados, categoria: categoriaObj } = await classificarTexto(transcricao);
  dados.fonte = 'AUDIO';
  if (!dados.descricao) dados.descricao = transcricao.substring(0, 200);
  return { dados, categoriaObj };
}

async function processarTexto(texto, telefone) {
  console.log(`[Processador] TEXTO de ${telefone}`);
  const { dados, categoria: categoriaObj } = await classificarTexto(texto);
  dados.fonte = 'TEXTO';
  return { dados, categoriaObj };
}

// --- Utilitários ---

async function resolverObra(codigo) {
  if (!codigo || codigo.toUpperCase() === 'GERAL') return null;

  const codigoNorm = codigo.toUpperCase();
  const obra = await prisma.obra.findFirst({
    where: { codigo: { equals: codigoNorm }, ativo: true },
  });

  if (!obra) {
    const novaObra = await prisma.obra.create({
      data: { codigo: codigoNorm, nome: `Obra ${codigoNorm}` },
    });
    return novaObra.id;
  }

  return obra.id;
}

/**
 * Converte um erro técnico numa mensagem amigável para o usuário do WhatsApp.
 */
function classificarErroUsuario(err) {
  const msg = (err.message || '').toLowerCase();

  if (msg.includes('timeout') || msg.includes('timedout')) {
    return '⏱️ A IA demorou mais do que o esperado para responder. Tente novamente em alguns instantes.';
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return '⚠️ Muitas requisições simultâneas. Aguarde 30 segundos e tente novamente.';
  }
  if (msg.includes('legibilidade') || msg.includes('ilegível')) {
    return '📸 Não consegui ler a imagem. Tente enviar com mais luz, foco ou descreva o gasto em texto.';
  }
  if (msg.includes('connect') || msg.includes('econnrefused')) {
    return '🔌 Problema de conexão com o servidor. Tente novamente em instantes.';
  }

  return '❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.';
}

module.exports = { processarMensagem, estadosConversa };
