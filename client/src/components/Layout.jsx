import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '◈' },
  { to: '/portfolio',  label: 'Portfolio',  icon: '◇' },
  { to: '/history',    label: 'History',    icon: '◎' },
  { to: '/settings',   label: 'Settings',   icon: '◉' },
];

function useNextBriefing() {
  const [info, setInfo] = useState({ label: 'AM', hours: 0, minutes: 0 });

  useEffect(() => {
    function calc() {
      const pst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const h = pst.getHours(), m = pst.getMinutes();
      let nextH, label;
      if (h < 7)       { nextH = 7;  label = 'AM'; }
      else if (h < 12) { nextH = 12; label = 'PM'; }
      else             { nextH = 31; label = 'AM'; } // 7am next day

      const next = new Date(pst);
      next.setHours(nextH % 24, 0, 0, 0);
      if (nextH >= 24) next.setDate(next.getDate() + 1);

      const diff = next - pst;
      setInfo({
        label,
        hours:   Math.floor(diff / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
      });
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  return info;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const briefing  = useNextBriefing();

  const handleLogout = () => { logout(); navigate('/welcome'); };

  return (
    <div className="flex h-screen bg-navy-950 text-slate-100 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className={`flex flex-col bg-navy-900 border-r border-slate-800 transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-800">
          <span className="text-teal-400 text-xl font-bold">🔥</span>
          {!collapsed && <span className="font-bold text-slate-100 tracking-tight">fire-pulse</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                 ${isActive
                   ? 'bg-teal-400/10 text-teal-400 font-medium'
                   : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`
              }
            >
              <span className="text-lg leading-none">{icon}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-slate-800 p-3 space-y-2">
          {!collapsed && (
            <p className="text-xs text-slate-500 truncate px-1">{user?.name}</p>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center py-1.5 text-slate-500 hover:text-slate-300 text-xs rounded hover:bg-slate-800 transition-colors"
          >
            {collapsed ? '→' : '← collapse'}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-navy-900/80 backdrop-blur border-b border-slate-800">
          <div className="text-xs text-slate-500">
            Next <span className="text-teal-400 font-medium">{briefing.label}</span> briefing in{' '}
            <span className="font-mono text-slate-300">
              {briefing.hours}h {briefing.minutes}m
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            sign out
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
