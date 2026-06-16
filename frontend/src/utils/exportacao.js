import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

function linhas(gastos) {
  return gastos.map((g) => ({
    Data:         g.data ? format(parseISO(g.data), 'dd/MM/yyyy') : '',
    Valor:        Number(g.valor),
    Categoria:    g.categoria?.nome ?? '',
    Subcategoria: g.subcategoria?.nome ?? '',
    Fornecedor:   g.fornecedor ?? '',
    Responsável:  g.usuario?.nome ?? '',
    Obra:         g.obra?.codigo ?? '',
    Fonte:        g.fonte ?? '',
    Descrição:    g.descricao ?? '',
  }));
}

export function exportarExcel(gastos, periodo = '') {
  const ws = XLSX.utils.json_to_sheet(linhas(gastos));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `gastos${periodo ? `_${periodo}` : ''}.xlsx`);
}

export function exportarPDF(gastos, periodo = '') {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(`Rorick Engenharia — Gastos${periodo ? ` (${periodo})` : ''}`, 14, 16);

  autoTable(doc, {
    startY: 22,
    head: [['Data','Valor','Categoria','Subcategoria','Fornecedor','Responsável','Obra','Fonte']],
    body: linhas(gastos).map((r) => [
      r.Data,
      r.Valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      r.Categoria, r.Subcategoria, r.Fornecedor, r.Responsável, r.Obra, r.Fonte,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [232, 160, 0], textColor: 0 },
  });

  doc.save(`gastos${periodo ? `_${periodo}` : ''}.pdf`);
}
