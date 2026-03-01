// color: 'teal' | 'red' | 'amber' | 'slate'
const BORDER = { teal: 'border-teal-400', red: 'border-red-400', amber: 'border-amber-400', slate: 'border-slate-600' };
const TEXT   = { teal: 'text-teal-400',   red: 'text-red-400',   amber: 'text-amber-400',   slate: 'text-slate-400' };

export default function StatTile({ label, value, sub, color = 'slate' }) {
  return (
    <div className={`bg-slate-900 rounded-xl border-t-2 ${BORDER[color]} p-4`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-mono font-semibold ${TEXT[color]}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
