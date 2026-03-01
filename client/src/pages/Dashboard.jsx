import { useEffect, useState } from 'react';
import api from '../lib/api';
import StatTile      from '../components/StatTile';
import BriefingCard  from '../components/BriefingCard';
import ExposureChart from '../components/ExposureChart';

export default function Dashboard() {
  const [briefings,  setBriefings]  = useState({ am: null, pm: null });
  const [holdings,   setHoldings]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/briefings/latest'),
      api.get('/portfolio'),
    ]).then(([b, p]) => {
      setBriefings(b.data);
      setHoldings(p.data);
    }).finally(() => setLoading(false));
  }, []);

  // Derive stats from latest briefing snapshot if available, else from holdings cost basis
  const snapshot = briefings.am?.market_snapshot || briefings.pm?.market_snapshot || null;

  const totalValue = snapshot
    ? holdings.reduce((sum, h) => sum + (snapshot[h.ticker]?.price ?? h.avg_cost) * h.shares, 0)
    : holdings.reduce((sum, h) => sum + h.avg_cost * h.shares, 0);

  const dayChangePct = snapshot
    ? holdings.reduce((sum, h) => {
        const p = snapshot[h.ticker];
        return p?.change_pct != null ? sum + (p.change_pct * p.price * h.shares) : sum;
      }, 0) / (totalValue || 1)
    : null;

  const dayChangeDollar = snapshot
    ? holdings.reduce((sum, h) => {
        const p = snapshot[h.ticker];
        return p?.change_pct != null ? sum + (p.price * h.shares * (p.change_pct / 100)) : sum;
      }, 0)
    : null;

  // Sector exposure from holdings
  const sectorMap = {};
  const totalCost = holdings.reduce((s, h) => s + h.avg_cost * h.shares, 0);
  holdings.forEach(h => {
    const sector = h.sector || 'Other';
    sectorMap[sector] = (sectorMap[sector] || 0) + (h.avg_cost * h.shares);
  });
  const sectorExposure = Object.fromEntries(
    Object.entries(sectorMap).map(([k, v]) => [k, totalCost ? (v / totalCost) * 100 : 0])
  );

  const fmtUSD = (n) => n != null ? `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';
  const fmtPct = (n) => n != null ? `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%` : '—';

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-100">Dashboard</h1>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Portfolio Value"
          value={fmtUSD(totalValue)}
          sub={snapshot ? 'live prices' : 'cost basis'}
          color="teal"
        />
        <StatTile
          label="Day Change $"
          value={dayChangeDollar != null ? `${dayChangeDollar >= 0 ? '+' : '−'}${fmtUSD(dayChangeDollar)}` : '—'}
          color={dayChangeDollar == null ? 'slate' : dayChangeDollar >= 0 ? 'teal' : 'red'}
        />
        <StatTile
          label="Day Change %"
          value={fmtPct(dayChangePct)}
          color={dayChangePct == null ? 'slate' : dayChangePct >= 0 ? 'teal' : 'red'}
        />
        <StatTile
          label="Holdings"
          value={holdings.length}
          sub={`${[...new Set(holdings.map(h => h.sector).filter(Boolean))].length} sectors`}
          color="amber"
        />
      </div>

      {/* Briefings + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Latest Briefings</h2>
          <BriefingCard briefing={briefings.am} label="AM" />
          <BriefingCard briefing={briefings.pm} label="PM" />
        </div>

        <div>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Sector Exposure</h2>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            {holdings.length === 0
              ? <p className="text-sm text-slate-500 text-center py-6">Add holdings to see exposure</p>
              : <ExposureChart sectorExposure={sectorExposure} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}
