import { useEffect, useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import HoldingRow   from '../components/HoldingRow';
import TickerSearch from '../components/TickerSearch';

const EMPTY_FORM = { ticker: '', shares: '', avg_cost: '', asset_type: 'stock', name: '', sector: '' };

export default function Portfolio() {
  const { holdings, loading, error, fetchHoldings, addHolding, updateHolding, deleteHolding } = usePortfolio();
  const [showAdd,  setShowAdd]  = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState('');

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const handleTickerSelect = (info) => {
    setForm(f => ({
      ...f,
      ticker: info.ticker,
      name:   info.name   || '',
      sector: info.sector || '',
      asset_type: info.assetType || 'stock',
    }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (!form.ticker) { setFormErr('Select a valid ticker first.'); return; }
    if (!form.shares || !form.avg_cost) { setFormErr('Shares and avg cost are required.'); return; }

    setSaving(true);
    try {
      await addHolding({
        ticker:     form.ticker,
        shares:     parseFloat(form.shares),
        avg_cost:   parseFloat(form.avg_cost),
        asset_type: form.asset_type,
      });
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } catch (e) {
      setFormErr(e.response?.data?.error || 'Failed to add holding.');
    } finally {
      setSaving(false);
    }
  };

  const totalValue = holdings.reduce((s, h) => s + h.avg_cost * h.shares, 0);
  const lastSync   = holdings.length
    ? new Date(Math.max(...holdings.map(h => new Date(h.updated_at || h.created_at))))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Portfolio</h1>
          {lastSync && <p className="text-xs text-slate-500 mt-0.5">Last synced: {lastSync}</p>}
        </div>
        <button
          onClick={() => { setShowAdd(s => !s); setForm(EMPTY_FORM); setFormErr(''); }}
          className="text-sm bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {showAdd ? 'cancel' : '+ Add Holding'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-medium text-slate-300">New Holding</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Ticker</label>
              <TickerSearch onSelect={handleTickerSelect} />
              {form.name && <p className="text-xs text-teal-400 mt-1">{form.name} · {form.sector || 'Unknown sector'}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Asset Type</label>
              <select
                value={form.asset_type}
                onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-teal-400"
              >
                {['stock','etf','crypto','bond','option'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Shares</label>
              <input type="number" step="any" value={form.shares}
                onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                placeholder="10"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm font-mono focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Avg Cost (per share)</label>
              <input type="number" step="any" value={form.avg_cost}
                onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))}
                placeholder="150.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm font-mono focus:outline-none focus:border-teal-400" />
            </div>
          </div>
          {formErr && <p className="text-sm text-red-400">{formErr}</p>}
          <button type="submit" disabled={saving || !form.ticker}
            className="bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
            {saving ? 'Saving…' : 'Save Holding'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Holdings table */}
      {holdings.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-10 text-center">
          <p className="text-slate-500 text-sm">No holdings yet.</p>
          <p className="text-slate-600 text-xs mt-1">Add your first position to get started.</p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-xs text-slate-500">{holdings.length} positions · cost basis ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="text-left py-2 px-4">Ticker</th>
                <th className="text-left py-2 px-4">Name</th>
                <th className="text-right py-2 px-4">Shares</th>
                <th className="text-right py-2 px-4">Avg Cost</th>
                <th className="text-right py-2 px-4">Value</th>
                <th className="text-left py-2 px-4">Sector</th>
                <th className="text-left py-2 px-4">Type</th>
                <th className="text-right py-2 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  onUpdate={updateHolding}
                  onDelete={deleteHolding}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
