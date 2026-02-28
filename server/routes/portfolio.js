import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const router = Router();

// GET /api/portfolio/validate?ticker=AAPL
// Returns { valid: true, name, sector, price } or { valid: false }
// Called on every debounced keystroke in TickerSearch component
router.get('/validate', async (req, res) => {
  const ticker = req.query.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'ticker is required' });

  try {
    const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });

    if (!quote?.regularMarketPrice) {
      return res.json({ valid: false });
    }

    return res.json({
      valid: true,
      name: quote.shortName || quote.longName || ticker,
      sector: quote.sector || null,
      price: quote.regularMarketPrice,
      assetType: deriveAssetType(quote.quoteType),
    });
  } catch {
    return res.json({ valid: false });
  }
});

function deriveAssetType(quoteType) {
  if (!quoteType) return 'stock';
  const map = { ETF: 'etf', CRYPTOCURRENCY: 'crypto', MUTUALFUND: 'etf', BOND: 'bond', OPTION: 'option' };
  return map[quoteType] ?? 'stock';
}

// GET    /api/portfolio           — implemented in Step 6
// POST   /api/portfolio           — implemented in Step 6
// PUT    /api/portfolio/:id       — implemented in Step 6
// DELETE /api/portfolio/:id       — implemented in Step 6
// GET    /api/portfolio/snapshots — implemented in Step 6

export default router;
