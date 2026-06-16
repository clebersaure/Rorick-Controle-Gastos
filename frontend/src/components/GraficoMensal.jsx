import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function GraficoMensal({ dados = [] }) {
  const ultimos6 = dados.slice(-6);

  const data = ultimos6.map((d, i) => ({
    mes: MESES[(d.mes - 1) % 12],
    total: d.total,
    atual: i === ultimos6.length - 1,
  }));

  return (
    <div className="card" style={{ height: 280 }}>
      <p style={{ fontWeight: 600, marginBottom: 12 }}>Gastos últimos 6 meses</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
          <XAxis dataKey="mes" tick={{ fill: '#666', fontSize: 12 }} />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#666', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6 }}
            formatter={(v) => [fmt(v), 'Total']}
            labelStyle={{ color: 'var(--text)' }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.atual ? '#df6011' : '#888888'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
