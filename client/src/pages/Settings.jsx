import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const [name,    setName]    = useState(user?.name || '');
  const [amOn,    setAmOn]    = useState(user?.am_briefing_enabled ?? true);
  const [pmOn,    setPmOn]    = useState(user?.pm_briefing_enabled ?? true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(null);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setName(data.name || '');
      setAmOn(data.am_briefing_enabled);
      setPmOn(data.pm_briefing_enabled);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const { data } = await api.put('/settings', {
        name,
        am_briefing_enabled: amOn,
        pm_briefing_enabled: pmOn,
      });
      updateUser(data);
      setMsg('Saved.');
    } catch {
      setMsg('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMS = async () => {
    setTesting(true);
    try {
      await api.post('/agent/run', { type: 'am' });
      setMsg('Briefing triggered — you\'ll get an SMS shortly.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to send test SMS.');
    } finally {
      setTesting(false);
    }
  };

  const handleRun = async (type) => {
    setRunning(type);
    try {
      await api.post('/agent/run', { type });
      setMsg(`${type.toUpperCase()} briefing started — check your phone in ~30s.`);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to trigger briefing.');
    } finally {
      setRunning(null);
    }
  };

  const Toggle = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-800">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-teal-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-lg font-semibold text-slate-100">Settings</h1>

      {/* Profile */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Profile</h2>
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Display name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div className="text-xs text-slate-500">Phone: <span className="font-mono text-slate-400">{user?.phone}</span></div>
      </div>

      {/* Briefing toggles */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Briefings</h2>
        <Toggle label="AM briefing (7:00 AM PST)" value={amOn} onChange={setAmOn} />
        <Toggle label="PM briefing (12:00 PM PST)" value={pmOn} onChange={setPmOn} />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 rounded-lg transition-colors text-sm"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      {/* Manual triggers */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Manual Triggers</h2>
        <p className="text-xs text-slate-500">Run a briefing now. Generates analysis and sends an SMS.</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleRun('am')}
            disabled={running === 'am'}
            className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-teal-400 text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {running === 'am' ? 'Running…' : 'Run AM'}
          </button>
          <button
            onClick={() => handleRun('pm')}
            disabled={running === 'pm'}
            className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-teal-400 text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {running === 'pm' ? 'Running…' : 'Run PM'}
          </button>
        </div>
      </div>

      {msg && (
        <p className={`text-sm text-center ${msg.includes('fail') || msg.includes('Failed') ? 'text-red-400' : 'text-teal-400'}`}>
          {msg}
        </p>
      )}

      {/* Danger zone */}
      <div className="bg-slate-900 rounded-xl border border-red-400/20 p-5">
        <h2 className="text-sm font-medium text-red-400/70 uppercase tracking-wider mb-3">Danger Zone</h2>
        <button
          onClick={logout}
          className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Sign out of all sessions
        </button>
      </div>
    </div>
  );
}
