import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import BriefingCard from '../components/BriefingCard';

const FILTERS = ['all', 'am', 'pm'];

export default function History() {
  const [briefings, setBriefings] = useState([]);
  const [filter,    setFilter]    = useState('all');
  const [offset,    setOffset]    = useState(0);
  const [hasMore,   setHasMore]   = useState(true);
  const [loading,   setLoading]   = useState(false);
  const LIMIT = 20;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const off = reset ? 0 : offset;
    try {
      const params = { limit: LIMIT, offset: off };
      if (filter !== 'all') params.type = filter;
      const { data } = await api.get('/briefings', { params });
      setBriefings(prev => reset ? data : [...prev, ...data]);
      setOffset(off + data.length);
      setHasMore(data.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    setBriefings([]);
    setOffset(0);
    setHasMore(true);
    load(true);
  }, [filter]); // eslint-disable-line

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">History</h1>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                filter === f
                  ? 'bg-teal-400/10 text-teal-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {briefings.length === 0 && !loading && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-10 text-center">
          <p className="text-slate-500 text-sm">No briefings yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {briefings.map(b => (
          <BriefingCard key={b.id} briefing={b} label={b.briefing_type?.toUpperCase()} />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {hasMore && !loading && briefings.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => load(false)}
            className="text-sm text-slate-500 hover:text-teal-400 transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
