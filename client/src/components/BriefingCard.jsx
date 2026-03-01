import { useState } from 'react';

const TYPE_COLOR = { am: 'from-teal-500/20 to-transparent', pm: 'from-amber-500/20 to-transparent' };
const TYPE_BADGE = { am: 'bg-teal-400/10 text-teal-400', pm: 'bg-amber-400/10 text-amber-400' };

export default function BriefingCard({ briefing, label }) {
  const [expanded, setExpanded] = useState(false);

  if (!briefing) {
    return (
      <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_BADGE[label?.toLowerCase()] ?? 'bg-slate-700 text-slate-400'}`}>
            {label}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-2">No briefing yet.</p>
      </div>
    );
  }

  const type   = briefing.briefing_type;
  const date   = new Date(briefing.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time   = new Date(briefing.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
  const failed = briefing.status === 'failed';

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Gradient accent bar */}
      <div className={`h-0.5 bg-gradient-to-r ${TYPE_COLOR[type] ?? 'from-slate-600/20 to-transparent'}`} />

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_BADGE[type] ?? 'bg-slate-700 text-slate-400'}`}>
              {type?.toUpperCase()}
            </span>
            {failed && <span className="text-xs px-2 py-0.5 rounded bg-red-400/10 text-red-400">failed</span>}
          </div>
          <span className="text-xs text-slate-500">{date} · {time}</span>
        </div>

        {/* SMS preview */}
        {briefing.content_sms && (
          <p className="text-sm text-slate-300 leading-relaxed mb-3">{briefing.content_sms}</p>
        )}

        {/* Expand / collapse full briefing */}
        {briefing.content_full && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
            >
              {expanded ? '▲ collapse' : '▼ full briefing'}
            </button>
            {expanded && (
              <pre className="mt-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-950 rounded-lg p-4 overflow-x-auto">
                {briefing.content_full}
              </pre>
            )}
          </>
        )}

        {failed && briefing.error_log && (
          <p className="text-xs text-red-400 mt-2 font-mono">{briefing.error_log}</p>
        )}
      </div>
    </div>
  );
}
