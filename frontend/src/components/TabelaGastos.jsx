import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useGastos, useCategorias, useUsuarios } from '../hooks/useGastos';

const POR_PAGINA = 20;

const FONTE_LABEL = { FOTO: '📷', AUDIO: '🎙️', TEXTO: '💬', WEB: '🖥️' };

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function TabelaGastos({ onExportar }) {
  const hoje = new Date();
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    categoriaId: '',
    usuarioId: '',
    page: 1,
  });

  const { data: gastos = [], isLoading } = useGastos({
    dataInicio: filtros.dataInicio || undefined,
    dataFim: filtros.dataFim || undefined,
    categoriaId: filtros.categoriaId || undefined,
    usuarioId: filtros.usuarioId || undefined,
    page: filtros.page,
    limit: POR_PAGINA,
  });

  const { data: categorias = [] } = useCategorias();
  const { data: usuarios = [] } = useUsuarios();

  const set = (k, v) => setFiltros((f) => ({ ...f, [k]: v, page: 1 }));

  return (
    <div className="card" style={{ marginTop: 24 }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 130px' }}>
          <label>Data início</label>
          <input type="date" value={filtros.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label>Data fim</label>
          <input type="date" value={filtros.dataFim} onChange={(e) => set('dataFim', e.target.value)} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label>Categoria</label>
          <select value={filtros.categoriaId} onChange={(e) => set('categoriaId', e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label>Responsável</label>
          <select value={filtros.usuarioId} onChange={(e) => set('usuarioId', e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => onExportar?.('excel', gastos)}>Excel</button>
          <button className="btn btn-ghost" onClick={() => onExportar?.('pdf', gastos)}>PDF</button>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {['Data','Valor','Categoria','Subcategoria','Fornecedor','Responsável','Fonte'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</td></tr>
            ) : gastos.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum gasto encontrado.</td></tr>
            ) : gastos.map((g) => (
              <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px' }}>
                  {g.data ? format(parseISO(g.data), 'dd/MM/yyyy') : '—'}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 600 }}>{fmt(g.valor)}</td>
                <td style={{ padding: '8px 10px' }}>{g.categoria?.nome ?? '—'}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{g.subcategoria?.nome ?? '—'}</td>
                <td style={{ padding: '8px 10px' }}>{g.fornecedor ?? '—'}</td>
                <td style={{ padding: '8px 10px' }}>{g.usuario?.nome ?? '—'}</td>
                <td style={{ padding: '8px 10px' }}>{FONTE_LABEL[g.fonte] ?? g.fonte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn-ghost"
          disabled={filtros.page <= 1}
          onClick={() => setFiltros((f) => ({ ...f, page: f.page - 1 }))}
        >‹ Anterior</button>
        <span style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Página {filtros.page}</span>
        <button
          className="btn btn-ghost"
          disabled={gastos.length < POR_PAGINA}
          onClick={() => setFiltros((f) => ({ ...f, page: f.page + 1 }))}
        >Próxima ›</button>
      </div>
    </div>
  );
}
