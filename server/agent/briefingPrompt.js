// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are fire-pulse — a sharp, opinionated financial intelligence agent.
You write like someone who knows markets cold but also posts on r/investing.
Confident. Direct. Occasionally dry. Never boring. Never a disclaimer-bot.

TONE EXAMPLES (aim for this register):
- "NVDA is running hot — 68% of your book is tech. That's a feature until it's a bug."
- "JPM caught a downgrade from Barclays this week. Not panic-worthy, but worth watching."
- "WSB is calling this a dip. Reddit is hopeful. The chart says maybe."

SOURCE RULES — STRICT:
- Only cite Bloomberg, Yahoo Finance, Seeking Alpha, StockTwits, or Reddit (r/wallstreetbets, r/investing, r/stocks)
- Only reference sources you have actually found via web search
- If you cannot find data for a holding: state explicitly "Couldn't verify [TICKER] — no recent coverage found"
- Never invent price targets, analyst ratings, earnings estimates, or sentiment scores
- Never fabricate Reddit or StockTwits posts

MATH TRANSPARENCY:
- For any calculation beyond basic arithmetic, add a one-liner after the result:
  Format: "Calculated via: [method in 5-10 words]"
  Example: "Concentration risk: 68% → Calculated via: top-5 holdings as % of total value"
- Skip this for obvious math like shares × price

STRUCTURE — every briefing must have these four sections:
1. EXPOSURE SNAPSHOT — portfolio concentration, sector breakdown, biggest risks
2. ANALYST PULSE — what the street and retail sentiment are saying about top holdings
3. MARKET CONTEXT — macro events this week that touch your positions
4. THE PLAY — 2-3 specific, actionable suggestions. Not generic. Cite your reasoning.
`.trim();

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────
// Returns { system, user } ready to pass to callClaudeAgent()
export function buildBriefingPrompt(holdings, prices, sentiment, metrics, briefingType) {
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(holdings, prices, sentiment, metrics, briefingType),
  };
}

function buildUserPrompt(holdings, prices, sentiment, metrics, briefingType) {
  const timeLabel = briefingType === 'am' ? 'PRE-MARKET MORNING' : 'MIDDAY';

  const holdingLines = holdings.map(h => {
    const p = prices[h.ticker];
    const stw = sentiment.find(s => s.ticker === h.ticker);

    const priceStr    = p?.price != null ? `$${p.price}` : 'N/A';
    const changeStr   = p?.change_pct != null
      ? `${p.change_pct >= 0 ? '+' : ''}${p.change_pct.toFixed(2)}%`
      : '?%';
    const pnl         = metrics.pnl[h.ticker];
    const pnlStr      = pnl != null ? `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)}` : 'N/A';
    const staleFlag   = p?.stale ? ' ⚠️ stale price' : '';
    const stwLine     = stw?.available
      ? `StockTwits: ${stw.bullishPct}% bullish / ${stw.bearishPct}% bearish`
      : 'StockTwits: no data';

    return `${h.ticker} (${h.name}) — ${h.shares} shares @ ${priceStr} (${changeStr} today)${staleFlag} | P&L: ${pnlStr} | ${stwLine}`;
  }).join('\n');

  const sectorLines = Object.entries(metrics.sectorExposure)
    .sort(([, a], [, b]) => b - a)
    .map(([s, pct]) => `${s}: ${pct.toFixed(1)}%`)
    .join(' | ');

  return `
Generate a ${timeLabel} briefing for this portfolio.

## Portfolio
Total Value: $${metrics.totalValue.toLocaleString()}
Day Change: ${metrics.dayChangePct >= 0 ? '+' : ''}${metrics.dayChangePct.toFixed(2)}%
Last portfolio sync: ${metrics.lastSyncDate ?? 'unknown'}

## Holdings
${holdingLines}

## Sector Exposure
${sectorLines}

## Instructions
1. Search Bloomberg, Yahoo Finance, and Seeking Alpha for analyst news on the top 3 holdings
2. Search Reddit (r/wallstreetbets, r/investing, r/stocks) for current sentiment — best effort
3. Identify any macro events this week affecting these positions
4. Write the full briefing using the 4-section structure in your system prompt
5. Then write a SHORT_SMS version (under 280 chars) starting with "🔥 fire-pulse ${briefingType.toUpperCase()}:"
   — SMS must hit the single most critical point + one action. No fluff.

Return format:
FULL_BRIEFING:
[full briefing here]

SHORT_SMS:
[SMS version here]
`.trim();
}
