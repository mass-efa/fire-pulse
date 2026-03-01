import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#14b8a6','#f59e0b','#6366f1','#ec4899','#8b5cf6','#f97316','#10b981','#3b82f6'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-200 font-medium">{payload[0].name}</p>
      <p className="text-teal-400 font-mono">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
};

export default function ExposureChart({ sectorExposure }) {
  const data = Object.entries(sectorExposure || {})
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }));

  if (!data.length) {
    return <p className="text-sm text-slate-500 text-center py-8">No sector data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
