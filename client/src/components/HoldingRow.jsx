import { useState } from 'react';

export default function HoldingRow({ holding, onUpdate, onDelete }) {
  const [editing, setEditing]   = useState(false);
  const [shares,  setShares]    = useState(holding.shares);
  const [avgCost, setAvgCost]   = useState(holding.avg_cost);
  const [saving,  setSaving]    = useState(false);
  const [confirm, setConfirm]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(holding.id, { shares: parseFloat(shares), avg_cost: parseFloat(avgCost) });
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm) { setConfirm(true); return; }
    await onDelete(holding.id);
  };

  const value = holding.shares * holding.avg_cost; // cost basis (no live price yet)

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
      <td className="py-3 px-4">
        <span className="font-mono text-sm font-semibold text-slate-100">{holding.ticker}</span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-400 max-w-[160px] truncate">{holding.name}</td>
      <td className="py-3 px-4 text-right font-mono text-sm">
        {editing
          ? <input type="number" value={shares} onChange={e => setShares(e.target.value)}
              className="w-20 bg-slate-800 border border-teal-400/50 rounded px-2 py-0.5 text-slate-100 text-xs font-mono text-right" />
          : <span className="text-slate-300">{holding.shares}</span>
        }
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm">
        {editing
          ? <input type="number" value={avgCost} onChange={e => setAvgCost(e.target.value)}
              className="w-24 bg-slate-800 border border-teal-400/50 rounded px-2 py-0.5 text-slate-100 text-xs font-mono text-right" />
          : <span className="text-slate-300">${Number(holding.avg_cost).toFixed(2)}</span>
        }
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-400">
        ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-slate-500">{holding.sector || '—'}</td>
      <td className="py-3 px-4 text-sm text-slate-500">{holding.asset_type}</td>
      <td className="py-3 px-4 text-right">
        {editing ? (
          <div className="flex gap-2 justify-end">
            <button onClick={handleSave} disabled={saving}
              className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50">
              {saving ? 'saving…' : 'save'}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300">cancel</button>
          </div>
        ) : (
          <div className="flex gap-3 justify-end">
            <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-teal-400 transition-colors">edit</button>
            <button onClick={handleDelete}
              className={`text-xs transition-colors ${confirm ? 'text-red-400 hover:text-red-300' : 'text-slate-600 hover:text-red-400'}`}>
              {confirm ? 'confirm?' : '✕'}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
