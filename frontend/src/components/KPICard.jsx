export default function KPICard({ label, valor, variacao, cor }) {
  const sobe = variacao >= 0;
  const seta = sobe ? '↑' : '↓';
  const corVar = sobe ? 'var(--success)' : 'var(--danger)';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${cor || 'var(--accent)'}`,
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      boxShadow: 'var(--shadow)',
    }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
        {typeof valor === 'number'
          ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : valor}
      </p>
      {variacao != null && (
        <p style={{ color: corVar, fontSize: 11, marginTop: 4 }}>
          {seta} {Math.abs(variacao).toFixed(1)}% vs mês anterior
        </p>
      )}
    </div>
  );
}
