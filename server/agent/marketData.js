import YahooFinance from 'yahoo-finance2';
import axios from 'axios';
import supabase from '../db/client.js';

const yahooFinance = new YahooFinance();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────
// Accepts an array of ticker strings.
// Returns { [ticker]: { price, change_pct, source, stale? } }
// Priority: cache → yahoo-finance2 → Alpha Vantage → last known (stale flag)
export async function fetchPrices(tickers) {
  if (!tickers.length) return {};

  const unique = [...new Set(tickers.map(t => t.toUpperCase()))];
  const now = Date.now();

  // 1. Check price_cache for all tickers
  const { data: cached } = await supabase
    .from('price_cache')
    .select('*')
    .in('ticker', unique);

  const results = {};
  const needsFetch = [];

  for (const ticker of unique) {
    const row = cached?.find(c => c.ticker === ticker);
    const age = row ? now - new Date(row.fetched_at).getTime() : Infinity;

    if (row && age < CACHE_TTL_MS) {
      // Cache hit — still fresh
      results[ticker] = { price: row.price, change_pct: row.change_pct, source: row.source };
    } else {
      needsFetch.push(ticker);
    }
  }

  if (!needsFetch.length) return results;

  // 2. Fetch stale/missing from yahoo-finance2
  const yahooResults = await fetchFromYahoo(needsFetch);

  // 3. Anything yahoo missed → try Alpha Vantage
  const yahooMissed = needsFetch.filter(t => !yahooResults[t]);
  const avResults = yahooMissed.length ? await fetchFromAlphaVantage(yahooMissed) : {};

  // 4. Merge, persist cache, fall back to stale cache if both failed
  for (const ticker of needsFetch) {
    const fresh = yahooResults[ticker] || avResults[ticker];

    if (fresh) {
      results[ticker] = fresh;
      await upsertCache(ticker, fresh);
    } else {
      // Both sources failed — use last known price with stale flag
      const { data: last } = await supabase
        .from('price_cache')
        .select('*')
        .eq('ticker', ticker)
        .maybeSingle();

      if (last) {
        results[ticker] = { price: last.price, change_pct: last.change_pct, source: last.source, stale: true };
        console.warn(`marketData: using stale price for ${ticker}`);
      } else {
        console.error(`marketData: no price data available for ${ticker}`);
      }
    }
  }

  return results;
}

// ─── YAHOO FINANCE (PRIMARY) ──────────────────────────────────────────────────
async function fetchFromYahoo(tickers) {
  const results = {};

  const settled = await Promise.allSettled(
    tickers.map(t => yahooFinance.quote(t, {}, { validateResult: false }))
  );

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value?.regularMarketPrice) {
      const q = result.value;
      results[tickers[i]] = {
        price: q.regularMarketPrice,
        change_pct: q.regularMarketChangePercent ?? null,
        source: 'yahoo',
      };
    }
  });

  return results;
}

// ─── ALPHA VANTAGE (FALLBACK) ─────────────────────────────────────────────────
async function fetchFromAlphaVantage(tickers) {
  const results = {};

  for (const ticker of tickers) {
    try {
      const { data } = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: ticker,
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        },
        timeout: 8000,
      });

      const q = data?.['Global Quote'];
      const price = parseFloat(q?.['05. price']);
      const changePct = parseFloat(q?.['10. change percent']?.replace('%', ''));

      if (price) {
        results[ticker] = {
          price,
          change_pct: isNaN(changePct) ? null : changePct,
          source: 'alphavantage',
        };
      }
    } catch (err) {
      console.error(`marketData: Alpha Vantage failed for ${ticker}:`, err.message);
    }
  }

  return results;
}

// ─── CACHE UPSERT ─────────────────────────────────────────────────────────────
async function upsertCache(ticker, data) {
  const { error } = await supabase.from('price_cache').upsert({
    ticker,
    price: data.price,
    change_pct: data.change_pct,
    source: data.source,
    fetched_at: new Date().toISOString(),
  });
  if (error) console.error(`marketData: cache upsert failed for ${ticker}:`, error.message);
}

// ─── PORTFOLIO METRICS ────────────────────────────────────────────────────────
// Called by the agent orchestrator after prices are fetched.
// holdings: rows from the holdings table
// prices: output of fetchPrices()
// returns: { totalValue, dayChangePct, dayChangeDollar, pnl, sectorExposure, lastSyncDate }
export function calculateMetrics(holdings, prices) {
  let totalValue = 0;
  let totalCost = 0;
  let dayChangeDollar = 0;
  const pnl = {};
  const sectorTotals = {};

  for (const h of holdings) {
    const p = prices[h.ticker];
    if (!p) continue;

    const value = p.price * h.shares;
    const cost = h.avg_cost * h.shares;
    const holdingPnl = value - cost;
    const holdingDayChange = p.change_pct != null ? value * (p.change_pct / 100) : 0;

    totalValue += value;
    totalCost += cost;
    dayChangeDollar += holdingDayChange;
    pnl[h.ticker] = holdingPnl;

    const sector = h.sector || 'Other';
    sectorTotals[sector] = (sectorTotals[sector] || 0) + value;
  }

  // Sector exposure as % of total portfolio
  const sectorExposure = {};
  for (const [sector, val] of Object.entries(sectorTotals)) {
    sectorExposure[sector] = totalValue > 0 ? (val / totalValue) * 100 : 0;
  }

  const dayChangePct = totalValue > 0 ? (dayChangeDollar / (totalValue - dayChangeDollar)) * 100 : 0;

  // Most recent holding update = last time user touched their portfolio
  const lastSyncDate = holdings.length
    ? holdings.map(h => h.updated_at || h.created_at).sort().reverse()[0].split('T')[0]
    : null;

  return {
    totalValue,
    totalCost,
    totalPnl: totalValue - totalCost,
    dayChangePct,
    dayChangeDollar,
    pnl,
    sectorExposure,
    lastSyncDate,
  };
}

// ─── TOP HOLDINGS BY VALUE ────────────────────────────────────────────────────
// Returns top N holdings sorted by current market value.
// Used by the agent to select which tickers to fetch sentiment for.
export function getTopHoldings(holdings, prices, n = 5) {
  return holdings
    .map(h => ({ ...h, value: (prices[h.ticker]?.price ?? 0) * h.shares }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}
