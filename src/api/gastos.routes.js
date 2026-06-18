const express = require('express');
const multer = require('multer');
const { autenticar, apenasAdmin } = require('./middlewares/auth');
const { listarGastos, resumoMensal, resumoPorCategoria, salvarGasto } = require('../db/gastos');
const { extrairDadosNotaBase64 } = require('../ai/ocr');
const { resolverCategoria, resolverSubcategoria } = require('../db/categorias');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    cb(null, permitidos.includes(file.mimetype));
  },
});

/** Valida que uma string é uma URL http/https bem formada. */
function validarUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /gastos
router.get('/', autenticar, async (req, res) => {
  try {
    const { mes, ano, categoriaId, usuarioId, obraId, page, limit } = req.query;

    const limiteParsed = Math.min(limit ? parseInt(limit) : 50, 200); // cap em 200

    const resultado = await listarGastos({
      mes: mes ? parseInt(mes) : undefined,
      ano: ano ? parseInt(ano) : undefined,
      categoriaId: categoriaId ? parseInt(categoriaId) : undefined,
      usuarioId: usuarioId ? parseInt(usuarioId) : undefined,
      obraId: obraId ? parseInt(obraId) : undefined,
      page: page ? Math.max(1, parseInt(page)) : 1,
      limit: limiteParsed,
    });

    res.json(resultado);
  } catch (err) {
    console.error('[Gastos] Erro ao listar:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar gastos. Tente novamente.' });
  }
});

// GET /gastos/resumo-mensal
router.get('/resumo-mensal', autenticar, async (req, res) => {
  try {
    const ano = req.query.ano ? parseInt(req.query.ano) : new Date().getFullYear();
    const resumo = await resumoMensal(ano);
    res.json(resumo);
  } catch (err) {
    console.error('[Gastos] Erro em resumo-mensal:', err.message);
    res.status(500).json({ erro: 'Erro ao gerar resumo. Tente novamente.' });
  }
});

// GET /gastos/resumo-categorias
router.get('/resumo-categorias', autenticar, async (req, res) => {
  try {
    const { mes, ano } = req.query;
    const resumo = await resumoPorCategoria({
      mes: mes ? parseInt(mes) : undefined,
      ano: ano ? parseInt(ano) : undefined,
    });
    res.json(resumo);
  } catch (err) {
    console.error('[Gastos] Erro em resumo-categorias:', err.message);
    res.status(500).json({ erro: 'Erro ao gerar resumo. Tente novamente.' });
  }
});

// POST /gastos/upload
router.post('/upload', autenticar, upload.single('nota'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo de imagem não enviado ou formato inválido' });
    }

    const dados = await extrairDadosNotaBase64(req.file.buffer, req.file.mimetype);

    if (dados.erro) {
      return res.status(422).json({ erro: dados.erro, dados });
    }

    return res.json({ extraido: true, dados });
  } catch (err) {
    console.error('[Gastos] Erro no upload/OCR:', err.message);
    return res.status(500).json({ erro: 'Erro ao processar imagem. Tente novamente.' });
  }
});

// POST /gastos/confirmar
router.post('/confirmar', autenticar, async (req, res) => {
  try {
    const { valor, data, fornecedor, descricao, categoria_sugerida, subcategoria_sugerida, obraId, imagemUrl } = req.body;

    if (!valor || Number(valor) <= 0) {
      return res.status(400).json({ erro: 'Valor inválido' });
    }
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ erro: 'Data inválida (esperado YYYY-MM-DD)' });
    }

    // Valida imagemUrl se fornecida — evita XSS via javascript: ou data:
    if (imagemUrl && !validarUrl(imagemUrl)) {
      return res.status(400).json({ erro: 'imagemUrl inválida' });
    }

    const categoria = await resolverCategoria(categoria_sugerida || 'Outros');
    if (!categoria) return res.status(400).json({ erro: 'Categoria inválida' });

    const subcategoria = await resolverSubcategoria(subcategoria_sugerida, categoria.id);

    const gasto = await salvarGasto({
      valor: parseFloat(Number(valor).toFixed(2)),
      data,
      fornecedor: fornecedor ? String(fornecedor).substring(0, 255) : null,
      descricao: descricao ? String(descricao).substring(0, 500) : null,
      categoriaId: categoria.id,
      subcategoriaId: subcategoria?.id || null,
      usuarioId: req.usuario.id,
      obraId: obraId ? parseInt(obraId) : null,
      imagemUrl: imagemUrl || null,
      fonte: 'WEB',
    });

    res.status(201).json(gasto);
  } catch (err) {
    console.error('[Gastos] Erro ao confirmar:', err.message);
    res.status(500).json({ erro: 'Erro ao salvar gasto. Tente novamente.' });
  }
});

module.exports = router;
