import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Verify() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();
  const { phone, name } = location.state || {};

  const [digits,   setDigits]   = useState(Array(6).fill(''));
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [blocked,  setBlocked]  = useState(false);
  const [resent,   setResent]   = useState(false);
  const [timer,    setTimer]    = useState(30);
  const refs = useRef([]);

  // Redirect if no phone
  useEffect(() => { if (!phone) navigate('/welcome'); }, [phone, navigate]);

  // Resend timer countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleChange = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
    if (next.every(d => d)) submitCode(next.join(''));
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      setDigits(paste.split(''));
      submitCode(paste);
    }
  };

  const submitCode = async (code) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, code, name });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (e) {
      const err = e.response?.data;
      if (err?.blocked || e.response?.status === 429) {
        setBlocked(true);
        setError('Too many attempts. Try again in 24 hours.');
      } else {
        const rem = err?.attemptsRemaining;
        setError(`That's not right${rem != null ? ` — ${rem} attempt${rem !== 1 ? 's' : ''} remaining` : ''}.`);
      }
      setDigits(Array(6).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    await api.post('/auth/request-otp', { phone, ...(name ? { name } : {}) });
    setResent(true);
    setTimer(30);
    setError('');
    setDigits(Array(6).fill(''));
    refs.current[0]?.focus();
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">🔥</div>
          <h1 className="text-xl font-bold text-slate-100">Check your phone</h1>
          <p className="text-sm text-slate-500 mt-1">
            We sent a code to <span className="text-slate-300 font-mono">{phone}</span>
          </p>
        </div>

        {/* 6-box OTP input */}
        <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => refs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading || blocked}
              className="w-11 h-14 text-center text-xl font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-400 disabled:opacity-50 transition-colors caret-transparent"
            />
          ))}
        </div>

        {loading && (
          <div className="flex justify-center mb-4">
            <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}
        {resent && !error && <p className="text-sm text-teal-400 text-center mb-4">Code resent!</p>}

        {!blocked && (
          <div className="text-center">
            {timer > 0
              ? <p className="text-xs text-slate-600">Resend in {timer}s</p>
              : <button onClick={handleResend} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
                  Didn't get it? Resend
                </button>
            }
          </div>
        )}
      </div>
    </div>
  );
}
