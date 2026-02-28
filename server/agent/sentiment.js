import axios from 'axios';

const STOCKTWITS_BASE = 'https://api.stocktwits.com/api/2/streams/symbol';

// ─── SINGLE TICKER ────────────────────────────────────────────────────────────
// Fetches retail sentiment from StockTwits for one ticker.
// Returns { ticker, bullishPct, bearishPct, topMessages, available }
// available = false when StockTwits has no tagged data or the request fails.
export async function getStockTwitsSentiment(ticker) {
  try {
    const { data } = await axios.get(`${STOCKTWITS_BASE}/${ticker}.json`, {
      timeout: 8000,
      headers: { 'User-Agent': 'fire-pulse/1.0' },
    });

    const messages = data.messages || [];
    const bullish = messages.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
    const bearish = messages.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;
    const total = bullish + bearish;

    return {
      ticker,
      bullishPct: total > 0 ? Math.round((bullish / total) * 100) : null,
      bearishPct: total > 0 ? Math.round((bearish / total) * 100) : null,
      topMessages: messages.slice(0, 3).map(m => m.body),
      available: total > 0,
    };
  } catch (err) {
    // 429 rate limit, 404 unknown ticker, network error — all treated as unavailable
    console.warn(`sentiment: StockTwits unavailable for ${ticker}:`, err.message);
    return { ticker, bullishPct: null, bearishPct: null, topMessages: [], available: false };
  }
}

// ─── BATCH ────────────────────────────────────────────────────────────────────
// Fetches sentiment for an array of tickers concurrently.
// Used by the agent orchestrator after getTopHoldings() selects top 5.
// Returns array of sentiment objects in the same order as input.
export async function getSentimentBatch(tickers) {
  return Promise.all(tickers.map(t => getStockTwitsSentiment(t)));
}
