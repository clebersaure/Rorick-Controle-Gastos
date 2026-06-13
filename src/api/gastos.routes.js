const express = require('express');
const multer = require('multer');
const path = require('path');
const { autenticar, apenasAdmin } = require('./middlewares/auth');
const { listarGastos, resumoMensal, resumoPorCategoria, salvarGasto } = require('../db/gastos');
const { extrairDadosNotaBase64 } = require('../ai/ocr');
const { resolverCategoria, resolverSubcategoria } = require('../db/categorias');

const router = express.Router();

// Multer para upload de imagens via web
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    cb(null, permitidos.includes(file.mimetype));
  },
});

// GET /gastos — lista com filtros opcionais
router.get('/', autenticar, async (req, res) => {
  const { mes, ano, categoriaId, usuarioId, obraId, page, limit } = req.query;

  const resultado = await listarGastos({
    mes: mes ? parseInt(mes) : undefined,
    ano: ano ? parseInt(ano) : undefined,
    categoriaId: categoriaId ? parseInt(categoriaId) : undefined,
    usuarioId: usuarioId ? parseInt(usuarioId) : undefined,
    obraId: obraId ? parseInt(obraId) : undefined,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 50,
  });

  res.json(resultado);
});

// GET /gastos/resumo-mensal
router.get('/resumo-mensal', autenticar, async (req, res) => {
  const ano = req.query.ano ? parseInt(req.query.ano) : new Date().getFullYear();
  const resumo = await resumoMensal(ano);
  res.json(resumo);
});

// GET /gastos/resumo-categorias
router.get('/resumo-categorias', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const resumo = await resumoPorCategoria({
    mes: mes ? parseInt(mes) : undefined,
    ano: ano ? parseInt(ano) : undefined,
  });
  res.json(resumo);
});

// POST /gastos/upload — registra gasto via upload de imagem (web)
router.post('/upload', autenticar, upload.single('nota'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: 'Arquivo de imagem não enviado ou formato inválido' });
  }

  // Extrai dados via OCR
  const dados = await extrairDadosNotaBase64(req.file.buffer, req.file.mimetype);

  if (dados.erro) {
    return res.status(422).json({ erro: dados.erro, dados });
  }

  // Retorna os dados extraídos para o frontend confirmar antes de salvar
  return res.json({ extraido: true, dados });
});

// POST /gastos/confirmar — salva gasto após confirmação no frontend
router.post('/confirmar', autenticar, async (req, res) => {
  const { valor, data, fornecedor, descricao, categoria_sugerida, subcategoria_sugerida, obraId, imagemUrl } = req.body;

  if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor inválido' });
  if (!data) return res.status(400).json({ erro: 'Data é obrigatória' });

  const categoria = await resolverCategoria(categoria_sugerida || 'Outros');
  if (!categoria) return res.status(400).json({ erro: 'Categoria inválida' });

  const subcategoria = await resolverSubcategoria(subcategoria_sugerida, categoria.id);

  const gasto = await salvarGasto({
    valor: parseFloat(valor),
    data,
    fornecedor,
    descricao,
    categoriaId: categoria.id,
    subcategoriaId: subcategoria?.id || null,
    usuarioId: req.usuario.id,
    obraId: obraId ? parseInt(obraId) : null,
    imagemUrl,
    fonte: 'WEB',
  });

  res.status(201).json(gasto);
});

module.exports = router;
