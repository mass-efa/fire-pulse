import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';
import axios from 'axios';
import supabase from '../db/client.js';

const router = Router();
const yahooFinance = new YahooFinance();

// In-memory validation cache: ticker → { result, expiresAt }
const validateCache = new Map();
const VALIDATE_TTL_MS     = 10 * 60 * 1000; // 10 min  — successful lookups
const VALIDATE_NEG_TTL_MS =  2 * 60 * 1000; // 2 min   — failed lookups (prevents hammering)

// Track when Yahoo last 429'd so we can skip it for a cooldown window
let yahooRateLimitedUntil = 0;
const YAHOO_COOLDOWN_MS = 60 * 1000; // 60 s cooldown after a 429

// ─── VALIDATE ────────────────────────────────────────────────────────────────
// GET /api/portfolio/validate?ticker=AAPL
// Must be defined before /:id to avoid being matched as an ID param.
//
// Cache hierarchy (fastest → slowest):
//   1. In-memory validateCache  (survives within a process, ~10 min TTL)
//   2. Supabase price_cache     (survives server restarts, 24 h TTL)
//   3. Yahoo Finance            (primary live source)
//   4. Alpha Vantage            (fallback, 25 req/day free tier)
const SUPABASE_VALIDATE_TTL_H = 24; // hours — persistent cache TTL

router.get('/validate', async (req, res) => {
  const ticker = req.query.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'ticker is required' });

  // 1. In-memory cache
  const cached = validateCache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.result);
  }

  // 2. Supabase persistent cache (only for positive results — negatives aren't stored)
  try {
    const { data: row } = await supabase
      .from('price_cache')
      .select('price, name, sector, asset_type, fetched_at')
      .eq('ticker', ticker)
      .single();

    if (row?.price) {
      const ageH = (Date.now() - new Date(row.fetched_at).getTime()) / 3_600_000;
      if (ageH < SUPABASE_VALIDATE_TTL_H) {
        const result = {
          valid: true,
          name: row.name || ticker,
          sector: row.sector || null,
          price: Number(row.price),
          assetType: row.asset_type || 'stock',
        };
        // Warm the in-memory cache so subsequent requests in this process are instant
        validateCache.set(ticker, { result, expiresAt: Date.now() + VALIDATE_TTL_MS });
        return res.json(result);
      }
    }
  } catch {
    // Non-fatal — continue to live sources
  }

  const yahooThrottled = Date.now() < yahooRateLimitedUntil;

  // 3. Try Yahoo Finance (unless currently rate-limited)
  if (!yahooThrottled) {
    try {
      const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });
      if (quote?.regularMarketPrice) {
        const result = {
          valid: true,
          name: quote.shortName || quote.longName || ticker,
          sector: quote.sector || null,
          price: quote.regularMarketPrice,
          assetType: deriveAssetType(quote.quoteType),
        };
        // Persist to both caches
        validateCache.set(ticker, { result, expiresAt: Date.now() + VALIDATE_TTL_MS });
        persistToSupabase(ticker, result, 'yahoo').catch(() => {});
        return res.json(result);
      }
    } catch (err) {
      if (err.message?.includes('429') || err.statusCode === 429) {
        yahooRateLimitedUntil = Date.now() + YAHOO_COOLDOWN_MS;
        console.warn(`validate: Yahoo 429 for ${ticker} — cooling down ${YAHOO_COOLDOWN_MS / 1000}s`);
      } else {
        console.warn(`validate: Yahoo failed for ${ticker} — ${err.message}`);
      }
    }
  }

  // 4. Fallback: Alpha Vantage GLOBAL_QUOTE
  try {
    const { data } = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: ticker,
        apikey: process.env.ALPHA_VANTAGE_API_KEY,
      },
      timeout: 6000,
    });
    const q = data?.['Global Quote'];
    const price = parseFloat(q?.['05. price']);
    if (price) {
      const result = {
        valid: true,
        name: ticker,   // AV GLOBAL_QUOTE doesn't return a name
        sector: null,
        price,
        assetType: 'stock',
      };
      validateCache.set(ticker, { result, expiresAt: Date.now() + VALIDATE_TTL_MS });
      persistToSupabase(ticker, result, 'alphavantage').catch(() => {});
      return res.json(result);
    }
    // Log AV rate-limit messages so we can see them in server logs
    if (data?.Information) console.warn(`validate: Alpha Vantage info for ${ticker} — ${data.Information}`);
  } catch (err) {
    console.warn(`validate: Alpha Vantage failed for ${ticker} — ${err.message}`);
  }

  // Cache the negative result briefly so rapid retries don't re-hit the APIs
  const invalid = { valid: false };
  validateCache.set(ticker, { result: invalid, expiresAt: Date.now() + VALIDATE_NEG_TTL_MS });
  return res.json(invalid);
});

// ─── SNAPSHOTS ────────────────────────────────────────────────────────────────
// GET /api/portfolio/snapshots
// Must be defined before /:id.
router.get('/snapshots', async (req, res) => {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('snapshot_date, total_value, created_at')
    .eq('user_id', req.userId)
    .order('snapshot_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET ALL HOLDINGS ─────────────────────────────────────────────────────────
// GET /api/portfolio
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── ADD HOLDING ──────────────────────────────────────────────────────────────
// POST /api/portfolio
// Body: { ticker, shares, avg_cost, asset_type? }
// name and sector are auto-filled from Yahoo Finance
router.post('/', async (req, res) => {
  const { ticker, shares, avg_cost, asset_type } = req.body;

  if (!ticker || shares == null || avg_cost == null) {
    return res.status(400).json({ error: 'ticker, shares, and avg_cost are required' });
  }

  const upperTicker = ticker.toUpperCase();
  let name = upperTicker;
  let sector = null;
  let finalAssetType = asset_type || 'stock';

  // Auto-fill name, sector, asset_type from Yahoo Finance
  try {
    const quote = await yahooFinance.quote(upperTicker, {}, { validateResult: false });
    if (quote?.regularMarketPrice) {
      name = quote.shortName || quote.longName || upperTicker;
      sector = quote.sector || null;
      if (!asset_type) finalAssetType = deriveAssetType(quote.quoteType);
    }
  } catch {
    // Non-fatal — proceed with ticker as name
  }

  const { data, error } = await supabase
    .from('holdings')
    .insert({
      user_id: req.userId,
      ticker: upperTicker,
      name,
      shares: Number(shares),
      avg_cost: Number(avg_cost),
      asset_type: finalAssetType,
      sector,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ─── UPDATE HOLDING ───────────────────────────────────────────────────────────
// PUT /api/portfolio/:id
// Body: { shares?, avg_cost? }
router.put('/:id', async (req, res) => {
  const { shares, avg_cost } = req.body;

  if (shares == null && avg_cost == null) {
    return res.status(400).json({ error: 'shares or avg_cost is required' });
  }

  const updates = { updated_at: new Date().toISOString() };
  if (shares != null)   updates.shares   = Number(shares);
  if (avg_cost != null) updates.avg_cost = Number(avg_cost);

  const { data, error } = await supabase
    .from('holdings')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)   // ownership check
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Holding not found' });
  res.json(data);
});

// ─── DELETE HOLDING ───────────────────────────────────────────────────────────
// DELETE /api/portfolio/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);  // ownership check

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Upsert a validated ticker into Supabase price_cache so it survives restarts.
async function persistToSupabase(ticker, result, source) {
  await supabase.from('price_cache').upsert({
    ticker,
    price: result.price,
    name: result.name,
    sector: result.sector,
    asset_type: result.assetType,
    source,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'ticker' });
}

function deriveAssetType(quoteType) {
  if (!quoteType) return 'stock';
  const map = { ETF: 'etf', CRYPTOCURRENCY: 'crypto', MUTUALFUND: 'etf', BOND: 'bond', OPTION: 'option' };
  return map[quoteType] ?? 'stock';
}

export default router;
