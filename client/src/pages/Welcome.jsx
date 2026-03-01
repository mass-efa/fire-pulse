import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

function toE164(raw) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('1') && digits.length <= 11) return `+${digits}`;
  if (digits.length <= 10) return `+1${digits}`;
  return `+${digits}`;
}

export default function Welcome() {
  const navigate = useNavigate();
  const [phone,    setPhone]    = useState('');
  const [name,     setName]     = useState('');
  const [needName, setNeedName] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const e164 = toE164(phone);
    if (e164.length < 10) { setError('Enter a valid phone number.'); setLoading(false); return; }

    try {
      const { data } = await api.post('/auth/request-otp', {
        phone: e164,
        ...(needName && name ? { name } : {}),
      });

      if (data.needsName) {
        setNeedName(true);
        setLoading(false);
        return;
      }

      navigate('/verify', { state: { phone: e164, name: needName ? name : undefined } });
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">🔥</div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">fire-pulse</h1>
          <p className="text-sm text-slate-500 mt-1">Your AI portfolio briefing. Twice daily.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-400 transition-colors font-mono"
              autoFocus
            />
          </div>

          {needName && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Your name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="First name"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-400 transition-colors"
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || (needName && !name)}
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Sending…' : 'Send me a code'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-8">
          No password. No email. Just a 6-digit code.
        </p>
      </div>
    </div>
  );
}
