const { extrairDadosNota } = require('../ai/ocr');
const { transcreverAudio } = require('../ai/whisper');
const { classificarTexto } = require('../ai/classificador');
const { salvarGasto } = require('../db/gastos');
const { resolverSubcategoria } = require('../db/categorias');
const { enviarTexto, enviarConfirmacao, enviarSolicitacaoObra } = require('./sender');
const prisma = require('../db/prisma');

// Estado de conversa em memória: telefone → { etapa, dados, categoriaObj, usuarioId }
// etapa: 'AGUARDANDO_OBRA' | 'AGUARDANDO_CONFIRMACAO'
const estadosConversa = new Map();

const ETAPA = {
  AGUARDANDO_OBRA: 'AGUARDANDO_OBRA',
  AGUARDANDO_CONFIRMACAO: 'AGUARDANDO_CONFIRMACAO',
};

/**
 * Ponto de entrada: processa uma mensagem recebida do WhatsApp.
 */
async function processarMensagem({ telefone, tipo, conteudo, usuario }) {
  const estado = estadosConversa.get(telefone);

  // Se há conversa em andamento, trata a resposta do usuário
  if (estado) {
    return tratarRespostaConversa(telefone, conteudo, estado, usuario);
  }

  // Nova mensagem — processa conforme o tipo
  let resultado; // { dados, categoriaObj }

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
    console.error(`[${new Date().toISOString()}] [Processador] Erro ao processar mensagem de ${telefone}:`, err.message);
    await enviarTexto(telefone, '❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
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

  // Guarda objeto categoria junto com os dados para usar na confirmação
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
    const obraId = await resolverObra(codigoObra);

    estado.dados.obra = codigoObra.toUpperCase() !== 'GERAL' ? codigoObra.toUpperCase() : null;
    estado.dados.obraId = obraId;
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

  // Usa o objeto categoria já resolvido pelo classificador; fallback para busca direta
  let categoria = categoriaObj;
  if (!categoria) {
    categoria = await prisma.categoria.findFirst({
      where: { nome: { contains: dados.categoria_sugerida || 'Material', mode: 'insensitive' }, ativo: true },
    });
  }

  if (!categoria) {
    await enviarTexto(telefone, '❌ Categoria não encontrada. Entre em contato com o administrador.');
    estadosConversa.delete(telefone);
    return;
  }

  const subcategoria = await resolverSubcategoria(dados.subcategoria_sugerida, categoria.id);

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

    console.log(`[${new Date().toISOString()}] [Processador] Gasto #${gasto.id} salvo — R$ ${gasto.valor} | cat: ${categoria.nome} | usuário: ${usuarioId}`);

    estadosConversa.delete(telefone);
    await enviarTexto(
      telefone,
      `✅ *Gasto registrado com sucesso!*\n\n🆔 ID: #${gasto.id}\n💰 R$ ${Number(gasto.valor).toFixed(2)}\n🏷️ ${categoria.nome}${subcategoria ? ` › ${subcategoria.nome}` : ''}`
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Processador] Erro ao salvar gasto:`, err.message);
    await enviarTexto(telefone, '❌ Erro ao salvar o gasto. Tente novamente.');
  }
}

// --- Processadores por tipo ---

async function processarFoto(imagemUrl, telefone) {
  console.log(`[${new Date().toISOString()}] [Processador] FOTO de ${telefone}`);
  const dados = await extrairDadosNota(imagemUrl);
  if (dados.erro) return { dados, categoriaObj: null };

  dados.imagemUrl = imagemUrl;
  dados.fonte = 'FOTO';

  // Resolve categoria via banco usando o nome sugerido pelo OCR
  let categoriaObj = null;
  if (dados.categoria_sugerida) {
    categoriaObj = await prisma.categoria.findFirst({
      where: { nome: { contains: dados.categoria_sugerida, mode: 'insensitive' }, ativo: true },
    });
  }

  return { dados, categoriaObj };
}

async function processarAudio(audioUrl, telefone) {
  console.log(`[${new Date().toISOString()}] [Processador] ÁUDIO de ${telefone}`);

  // 1) Transcreve com Whisper
  const transcricao = await transcreverAudio(audioUrl);

  // 2) Classifica o texto transcrito e busca Categoria no banco
  const { dados, categoria: categoriaObj } = await classificarTexto(transcricao);

  dados.fonte = 'AUDIO';
  // Preserva a transcrição original como descrição se o classificador não extraiu uma
  if (!dados.descricao) dados.descricao = transcricao.substring(0, 200);

  return { dados, categoriaObj };
}

async function processarTexto(texto, telefone) {
  console.log(`[${new Date().toISOString()}] [Processador] TEXTO de ${telefone}`);

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
    // Cria automaticamente obras desconhecidas para não bloquear o fluxo
    const novaObra = await prisma.obra.create({
      data: { codigo: codigoNorm, nome: `Obra ${codigoNorm}` },
    });
    return novaObra.id;
  }

  return obra.id;
}

module.exports = { processarMensagem, estadosConversa };
