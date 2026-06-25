const axios = require('axios');
const { comRetry, erroAxiosTransitorio } = require('../utils/retry');

function zapiHeaders() {
  return {
    'Client-Token': process.env.ZAPI_TOKEN,
    'Content-Type': 'application/json',
  };
}

function zapiUrl(endpoint) {
  const base = process.env.ZAPI_BASE_URL || 'https://api.z-api.io/instances';
  return `${base}/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/${endpoint}`;
}

/**
 * Envia mensagem de texto simples com retry (até 3 tentativas, timeout 15s).
 * Erros são logados mas nunca propagados — o bot não deve travar por falha de envio.
 */
async function enviarTexto(telefone, mensagem) {
  try {
    await comRetry(
      () =>
        axios.post(
          zapiUrl('send-text'),
          { phone: telefone, message: mensagem },
          { headers: zapiHeaders(), timeout: 15_000 }
        ),
      {
        tentativas: 3,
        delayMs: 2000,
        deveRetentar: (err) => {
          // Não retenta se Z-API retornou erro de autenticação ou número inválido
          if (err.response?.status === 401 || err.response?.status === 400) return false;
          return erroAxiosTransitorio(err);
        },
      }
    );
    console.log(`[Sender] Mensagem enviada para ${telefone}`);
  } catch (err) {
    // Z-API indisponível: log e segue — melhor do que travar o processamento
    console.error(`[Sender] Falha definitiva ao enviar para ${telefone} após retentativas:`, err.message);
  }
}

/**
 * Formata e envia o resumo de um gasto para confirmação do usuário.
 */
async function enviarConfirmacao(telefone, dados) {
  const dataFormatada = dados.data
    ? new Date(dados.data + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'não identificada';

  const linhas = [
    '📋 *Resumo do gasto detectado:*',
    '',
    `💰 *Valor:* R$ ${Number(dados.valor).toFixed(2)}`,
    `📅 *Data:* ${dataFormatada}`,
    dados.fornecedor ? `🏪 *Fornecedor:* ${dados.fornecedor}` : null,
    dados.descricao ? `📝 *Descrição:* ${dados.descricao}` : null,
    `🏷️ *Categoria:* ${dados.categoria_sugerida || 'Outros'}`,
    dados.subcategoria_sugerida ? `   └ *Subcategoria:* ${dados.subcategoria_sugerida}` : null,
    dados.obra ? `🏗️ *Obra:* ${dados.obra}` : null,
    '',
    'Confirmar o registro? Responda *SIM* ou *NÃO*',
  ].filter(Boolean);

  await enviarTexto(telefone, linhas.join('\n'));
}

async function enviarSolicitacaoObra(telefone) {
  await enviarTexto(
    telefone,
    '🏗️ *Qual é o código da obra?*\n\nDigite o número/código da pasta/obra a que se refere este gasto.\nEx: 001, OBR-2024-05\n\nOu digite *GERAL* para gasto não vinculado a obra.'
  );
}

async function notificarAdmins(admins, mensagem) {
  for (const admin of admins) {
    await enviarTexto(admin.telefone, mensagem);
  }
}

module.exports = { enviarTexto, enviarConfirmacao, enviarSolicitacaoObra, notificarAdmins };
