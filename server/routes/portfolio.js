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
router.get('/validate', async (req, res) => {
  const ticker = req.query.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'ticker is required' });

  // Serve from cache if still fresh (covers both valid and invalid results)
  const cached = validateCache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.result);
  }

  const yahooThrottled = Date.now() < yahooRateLimitedUntil;

  // Try Yahoo Finance first (unless currently rate-limited)
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
        validateCache.set(ticker, { result, expiresAt: Date.now() + VALIDATE_TTL_MS });
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

  // Fallback: Alpha Vantage GLOBAL_QUOTE
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
        name: ticker,       // AV GLOBAL_QUOTE doesn't return a name
        sector: null,
        price,
        assetType: 'stock',
      };
      validateCache.set(ticker, { result, expiresAt: Date.now() + VALIDATE_TTL_MS });
      return res.json(result);
    }
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
function deriveAssetType(quoteType) {
  if (!quoteType) return 'stock';
  const map = { ETF: 'etf', CRYPTOCURRENCY: 'crypto', MUTUALFUND: 'etf', BOND: 'bond', OPTION: 'option' };
  return map[quoteType] ?? 'stock';
}

export default router;
