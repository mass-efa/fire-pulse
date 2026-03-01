import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

// Calls GET /api/portfolio/validate?ticker=X on each keystroke (debounced 400ms).
// onSelect({ ticker, name, sector, price, assetType }) fires when a valid ticker is confirmed.
export default function TickerSearch({ onSelect, initialValue = '' }) {
  const [value,  setValue]  = useState(initialValue);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'valid' | 'invalid'
  const [info,   setInfo]   = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);

    const ticker = value.trim().toUpperCase();

    if (!ticker) {
      setStatus('idle');
      setInfo(null);
      return;
    }

    setStatus('loading');

    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/portfolio/validate', { params: { ticker } });
        if (data.valid) {
          setStatus('valid');
          setInfo(data);
          onSelect?.({ ticker, ...data });
        } else {
          setStatus('invalid');
          setInfo(null);
        }
      } catch {
        setStatus('invalid');
        setInfo(null);
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const borderClass =
    status === 'valid'   ? 'border-teal-400' :
    status === 'invalid' ? 'border-red-400'  :
                           'border-slate-700 focus-within:border-teal-400';

  return (
    <div>
      <div className={`relative flex items-center bg-slate-800 border rounded-lg transition-colors ${borderClass}`}>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value.toUpperCase())}
          placeholder="AAPL"
          spellCheck={false}
          autoCapitalize="characters"
          className="flex-1 bg-transparent px-3 py-2.5 text-slate-100 text-sm font-mono uppercase placeholder-slate-600 focus:outline-none"
        />

        {/* Status indicator */}
        <span className="pr-3">
          {status === 'loading' && (
            <span className="block w-4 h-4 border-2 border-slate-600 border-t-teal-400 rounded-full animate-spin" />
          )}
          {status === 'valid' && (
            <span className="text-teal-400 text-sm font-bold">✓</span>
          )}
          {status === 'invalid' && value && (
            <span className="text-red-400 text-sm font-bold">✗</span>
          )}
        </span>
      </div>

      {/* Sub-label */}
      {status === 'valid' && info && (
        <p className="text-xs text-teal-400 mt-1 truncate">
          {info.name}
          {info.price != null && <span className="text-slate-500"> · ${info.price.toFixed(2)}</span>}
        </p>
      )}
      {status === 'invalid' && value && (
        <p className="text-xs text-red-400 mt-1">Ticker not found</p>
      )}
    </div>
  );
}
