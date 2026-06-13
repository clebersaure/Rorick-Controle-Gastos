const { extrairDadosNota } = require('../ai/ocr');
const { transcreverAudio } = require('../ai/whisper');
const { classificarTexto } = require('../ai/classificador');
const { salvarGasto } = require('../db/gastos');
const { resolverCategoria, resolverSubcategoria } = require('../db/categorias');
const { enviarTexto, enviarConfirmacao, enviarSolicitacaoObra } = require('./sender');
const prisma = require('../db/prisma');

// Estado de conversa em memória: telefone → { etapa, dados }
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

  // Se há uma conversa em andamento, trata a resposta do usuário
  if (estado) {
    return tratarRespostaConversa(telefone, conteudo, estado, usuario);
  }

  // Nova mensagem — processa conforme o tipo
  let dadosExtraidos;

  try {
    if (tipo === 'FOTO') {
      dadosExtraidos = await processarFoto(conteudo.imagemUrl, telefone);
    } else if (tipo === 'AUDIO') {
      dadosExtraidos = await processarAudio(conteudo.audioUrl, telefone);
    } else if (tipo === 'TEXTO') {
      dadosExtraidos = await processarTexto(conteudo.texto, telefone);
    } else {
      await enviarTexto(telefone, '❓ Tipo de mensagem não suportado. Envie uma foto de nota, áudio ou texto descrevendo o gasto.');
      return;
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Processador] Erro ao processar mensagem de ${telefone}:`, err.message);
    await enviarTexto(telefone, '❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
    return;
  }

  if (!dadosExtraidos || dadosExtraidos.erro) {
    const motivo = dadosExtraidos?.erro || 'não foi possível extrair os dados';
    await enviarTexto(telefone, `⚠️ Não consegui identificar o gasto: ${motivo}.\n\nTente enviar a foto com mais nitidez ou descreva o gasto em texto.`);
    return;
  }

  if (!dadosExtraidos.valor || dadosExtraidos.valor <= 0) {
    await enviarTexto(telefone, '⚠️ Não consegui identificar o valor do gasto. Por favor, descreva o gasto em texto com o valor.');
    return;
  }

  // Salva dados na conversa e pede o código da obra
  estadosConversa.set(telefone, {
    etapa: ETAPA.AGUARDANDO_OBRA,
    dados: dadosExtraidos,
    usuarioId: usuario.id,
  });

  await enviarSolicitacaoObra(telefone);
}

async function tratarRespostaConversa(telefone, conteudo, estado, usuario) {
  const texto = (conteudo.texto || '').trim().toUpperCase();

  if (estado.etapa === ETAPA.AGUARDANDO_OBRA) {
    // Usuário informou o código da obra
    const codigoObra = (conteudo.texto || '').trim();
    const obraId = await resolverObra(codigoObra);

    estado.dados.obra = codigoObra !== 'GERAL' ? codigoObra : null;
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
  const { dados, usuarioId } = estado;

  // Resolve categoria no banco (fuzzy match pelo nome sugerido)
  const categoria = await resolverCategoria(dados.categoria_sugerida || 'Outros');
  const categoriaId = categoria?.id;

  if (!categoriaId) {
    await enviarTexto(telefone, '❌ Categoria inválida. Entre em contato com o administrador.');
    estadosConversa.delete(telefone);
    return;
  }

  const subcategoria = await resolverSubcategoria(dados.subcategoria_sugerida, categoriaId);

  try {
    const gasto = await salvarGasto({
      valor: dados.valor,
      data: dados.data,
      fornecedor: dados.fornecedor,
      descricao: dados.descricao,
      categoriaId,
      subcategoriaId: subcategoria?.id || null,
      usuarioId,
      obraId: dados.obraId || null,
      imagemUrl: dados.imagemUrl || null,
      fonte: dados.fonte || 'TEXTO',
    });

    console.log(`[${new Date().toISOString()}] [Processador] Gasto #${gasto.id} salvo — R$ ${gasto.valor} por usuário ${usuarioId}`);

    estadosConversa.delete(telefone);
    await enviarTexto(
      telefone,
      `✅ *Gasto registrado com sucesso!*\n\n🆔 ID: #${gasto.id}\n💰 R$ ${Number(gasto.valor).toFixed(2)}\n🏷️ ${categoria.nome}`
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Processador] Erro ao salvar gasto:`, err.message);
    await enviarTexto(telefone, '❌ Erro ao salvar o gasto. Tente novamente.');
  }
}

async function processarFoto(imagemUrl, telefone) {
  console.log(`[${new Date().toISOString()}] [Processador] Processando foto de ${telefone}`);
  const dados = await extrairDadosNota(imagemUrl);
  if (!dados.erro) dados.imagemUrl = imagemUrl;
  dados.fonte = 'FOTO';
  return dados;
}

async function processarAudio(audioUrl, telefone) {
  console.log(`[${new Date().toISOString()}] [Processador] Processando áudio de ${telefone}`);
  const transcricao = await transcreverAudio(audioUrl);
  const dados = await classificarTexto(transcricao);
  dados.fonte = 'AUDIO';
  dados.descricao = dados.descricao || transcricao.substring(0, 200);
  return dados;
}

async function processarTexto(texto, telefone) {
  console.log(`[${new Date().toISOString()}] [Processador] Processando texto de ${telefone}`);
  const dados = await classificarTexto(texto);
  dados.fonte = 'TEXTO';
  return dados;
}

async function resolverObra(codigo) {
  if (!codigo || codigo.toUpperCase() === 'GERAL') return null;

  const obra = await prisma.obra.findFirst({
    where: { codigo: { equals: codigo, mode: 'insensitive' }, ativo: true },
  });

  // Cria a obra automaticamente se não existir (código serve como ID)
  if (!obra) {
    const novaObra = await prisma.obra.create({
      data: { codigo: codigo.toUpperCase(), nome: `Obra ${codigo.toUpperCase()}` },
    });
    return novaObra.id;
  }

  return obra.id;
}

module.exports = { processarMensagem, estadosConversa };
