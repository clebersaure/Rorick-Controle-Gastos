import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useResumoMensal, useResumoCategorias } from '../hooks/useGastos';
import Logo from '../components/Logo';
import KPICard from '../components/KPICard';
import GraficoMensal from '../components/GraficoMensal';
import GraficoCategorias from '../components/GraficoCategorias';
import TabelaGastos from '../components/TabelaGastos';
import { exportarExcel, exportarPDF } from '../utils/exportacao';

function calcVariacao(dados) {
  if (!dados || dados.length < 2) return null;
  const atual = dados[dados.length - 1]?.total ?? 0;
  const ant   = dados[dados.length - 2]?.total ?? 0;
  if (ant === 0) return null;
  return ((atual - ant) / ant) * 100;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  const { data: mensal = [] } = useResumoMensal(anoAtual);
  const { data: porCategoria = [] } = useResumoCategorias(mesAtual, anoAtual);

  const totalMes      = mensal.find((m) => m.mes === mesAtual)?.total ?? 0;
  const totalAno      = mensal.reduce((s, m) => s + (m.total ?? 0), 0);
  const variacao      = calcVariacao(mensal.filter((m) => m.mes <= mesAtual));
  const maioriaCat    = porCategoria[0]?.nome ?? '—';
  const qtdLancamentos = mensal.find((m) => m.mes === mesAtual)?.quantidade ?? 0;

  function handleExportar(tipo, gastos) {
    const per = format(hoje, 'MM-yyyy');
    if (tipo === 'excel') exportarExcel(gastos, per);
    else exportarPDF(gastos, per);
  }

  function sair() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ===== Sidebar ===== */}
      <aside style={{
        width: 240,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: 24,
        flexShrink: 0,
      }}>
        {/* Título sidebar */}
        <div style={{ padding: '0 4px 20px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Visão geral dos gastos — {format(hoje, 'MM/yyyy')}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Resumo — {format(hoje, 'MM/yyyy')}
          </p>
          <KPICard label="Gasto do mês" valor={totalMes} variacao={variacao} cor="var(--accent)" />
          <KPICard label="Gasto no ano" valor={totalAno} cor="#888" />
          <KPICard label="Maior categoria" valor={maioriaCat} cor="var(--accent-dim)" />
          <KPICard label="Lançamentos" valor={qtdLancamentos} cor="var(--success)" />
        </div>

        {/* Spacer + Sair */}
        <div style={{ marginTop: 'auto' }}>
          <button className="btn btn-ghost" onClick={sair} style={{ width: '100%', justifyContent: 'center' }}>
            Sair
          </button>
        </div>
      </aside>

      {/* ===== Conteúdo principal ===== */}
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <header style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <Logo height={150} style={{ color: 'var(--text)' }} />
        </header>

        <div style={{ padding: '24px', flex: 1 }}>
        {/* Gráficos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <GraficoMensal dados={mensal} />
          <GraficoCategorias dados={porCategoria} />
        </div>

        {/* Tabela */}
        <TabelaGastos onExportar={handleExportar} />
        </div>
      </main>
    </div>
  );
}
