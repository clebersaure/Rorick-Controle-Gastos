import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const PALETTE = ['#df6011','#e13613','#c45010','#888888','#AAAAAA','#5C5C5C','#a83d0d','#6E6E6E'];

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function GraficoCategorias({ dados = [] }) {
  const data = [...dados]
    .sort((a, b) => b.total - a.total)
    .map((d) => ({ name: d.nome ?? d.categoria, total: d.total }));

  return (
    <div className="card" style={{ height: 280 }}>
      <p style={{ fontWeight: 600, marginBottom: 12 }}>Gastos por categoria</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#666', fontSize: 11 }}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: '#666', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6 }}
            formatter={(v) => [fmt(v), 'Total']}
            labelStyle={{ color: '#1a1a1a' }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
