# fire-pulse — Claude Code Project Spec (v2)

## Project Overview
Build a full-stack multi-user financial intelligence agent called **fire-pulse**.
An AI agent (Claude) analyzes each user's portfolio twice daily (7am + 12pm PST)
using live market data and sentiment sources, then sends a personalized SMS briefing
with portfolio exposure, sourced analyst sentiment, and actionable suggestions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL only — no Supabase Auth) |
| Authentication | Custom phone OTP via Twilio SMS + JWT session tokens |
| AI Agent | Anthropic Claude API `claude-sonnet-4-20250514` + web_search tool |
| Market Data | yahoo-finance2 (primary, free, no key) + Alpha Vantage (fallback) |
| Sentiment Sources | StockTwits API (primary retail), Reddit via web search (best effort) |
| News Sources | Bloomberg, Yahoo Finance, Seeking Alpha via web search |
| SMS | Twilio Programmable Messaging |
| Scheduler | node-cron + trading-calendars (market holiday detection) |
| Deployment | Render.com |

---

## Monorepo Structure

```
fire-pulse/
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── lib/
│       │   ├── supabase.js          # Supabase client (DB queries only)
│       │   └── api.js               # Axios instance — attaches JWT to every request
│       ├── hooks/
│       │   ├── useAuth.js           # Auth state, login/logout helpers
│       │   └── usePortfolio.js      # Holdings CRUD + ticker validation
│       ├── pages/
│       │   ├── Welcome.jsx          # Phone number entry (signup + login in one screen)
│       │   ├── Verify.jsx           # 6-digit OTP entry screen
│       │   ├── Dashboard.jsx        # Portfolio stats + latest AM/PM briefing
│       │   ├── Portfolio.jsx        # Manual holdings management with live ticker validation
│       │   ├── History.jsx          # Full briefing archive, filterable
│       │   └── Settings.jsx         # Name, AM/PM toggles, test SMS, manual briefing trigger
│       └── components/
│           ├── Layout.jsx           # Collapsible sidebar + sticky topbar
│           ├── HoldingRow.jsx       # Single row in holdings table
│           ├── TickerSearch.jsx     # Live ticker validation input component
│           ├── BriefingCard.jsx     # Expandable briefing display
│           ├── ExposureChart.jsx    # Recharts sector pie chart
│           └── StatTile.jsx         # Top-border color-coded stat tile
│
├── server/
│   ├── package.json
│   ├── index.js                     # Express app entry point
│   ├── middleware/
│   │   └── requireAuth.js           # JWT verification — applied to all protected routes
│   ├── routes/
│   │   ├── auth.js                  # POST /request-otp, POST /verify-otp
│   │   ├── portfolio.js             # Holdings CRUD + ticker validation endpoint
│   │   ├── briefings.js             # GET history, GET latest
│   │   └── agent.js                 # POST /run — manual trigger for testing
│   ├── auth/
│   │   ├── otp.js                   # Generate, store, verify OTP codes
│   │   └── jwt.js                   # Sign + verify JWT tokens (30-day expiry)
│   ├── agent/
│   │   ├── index.js                 # Orchestrator — runs full pipeline per user
│   │   ├── marketData.js            # yahoo-finance2 primary + Alpha Vantage fallback + cache
│   │   ├── sentiment.js             # StockTwits API + Reddit web search (best effort)
│   │   ├── briefingPrompt.js        # Builds system + user prompts
│   │   └── sms.js                   # Twilio sender (used by both auth OTP and briefings)
│   ├── scheduler/
│   │   └── index.js                 # node-cron 7am + 12pm + market holiday check
│   └── db/
│       ├── client.js                # Supabase service-role client
│       └── migrations/
│           └── 001_initial.sql      # All table definitions
│
├── .env.example
├── .gitignore
└── README.md
```

---

## Database Schema

```sql
-- 001_initial.sql
-- No Supabase Auth. All auth is custom phone OTP + JWT.

-- ─── USERS ────────────────────────────────────────────────────────────────────
create table users (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  phone                text not null unique,        -- E.164 e.g. +14155550123
  am_briefing_enabled  boolean default true,
  pm_briefing_enabled  boolean default true,
  created_at           timestamptz default now(),
  last_login_at        timestamptz
);

-- ─── OTP CODES ────────────────────────────────────────────────────────────────
-- Short-lived, single-use login codes. Shared by signup and login flows.
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code        text not null,                        -- 6-digit string
  expires_at  timestamptz not null,                 -- now() + 10 minutes
  used        boolean default false,
  attempts    int default 0,                        -- failed verify attempts
  blocked     boolean default false,                -- true after 5 failed attempts
  created_at  timestamptz default now()
);

create index otp_phone_idx on otp_codes(phone);

-- Cleanup job: delete expired OTP rows nightly (add to scheduler)
-- delete from otp_codes where expires_at < now();

-- ─── HOLDINGS ─────────────────────────────────────────────────────────────────
-- Manual entry only for MVP. CSV import is V2.
create table holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  ticker      text not null,
  name        text not null,                        -- auto-filled from Yahoo Finance on entry
  shares      numeric not null,
  avg_cost    numeric not null,
  asset_type  text default 'stock',                 -- stock | etf | crypto | bond | option
  sector      text,                                 -- auto-filled from Yahoo Finance on entry
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── PRICE CACHE ──────────────────────────────────────────────────────────────
-- Prevents redundant API calls. All users share cached prices.
-- Cache is valid for 15 minutes. Checked before any live fetch.
create table price_cache (
  ticker      text primary key,
  price       numeric not null,
  change_pct  numeric,                              -- day change %
  source      text default 'yahoo',                 -- 'yahoo' | 'alphavantage'
  fetched_at  timestamptz default now()
);

-- ─── PORTFOLIO SNAPSHOTS ───────────────────────────────────────────────────────
-- One snapshot per user per day (AM briefing only).
-- If no new snapshot exists, agent uses the most recent one available.
create table portfolio_snapshots (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete cascade,
  snapshot_date  date not null default current_date,
  holdings_json  jsonb not null,                    -- full holdings with prices at snapshot time
  total_value    numeric,
  created_at     timestamptz default now(),
  unique(user_id, snapshot_date)                    -- one per user per day
);

-- ─── BRIEFINGS ────────────────────────────────────────────────────────────────
create table briefings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references users(id) on delete cascade,
  briefing_type    text not null,                   -- 'am' | 'pm'
  status           text default 'pending',          -- 'pending' | 'completed' | 'failed'
  content_full     text,                            -- full markdown briefing (null if failed)
  content_sms      text,                            -- condensed SMS version ~280 chars
  market_snapshot  jsonb,                           -- prices at time of run
  error_log        text,                            -- error message if status = 'failed'
  retry_count      int default 0,                   -- max 1 retry
  sent_at          timestamptz default now()
);
```

---

## Environment Variables (.env.example)

```env
# Anthropic
ANTHROPIC_API_KEY=

# Supabase (no Auth — DB only)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=           # Server-side only. Never expose to client.
VITE_SUPABASE_URL=              # Same URL — safe to expose to client
VITE_SUPABASE_ANON_KEY=         # Anon/public key — safe to expose to client

# Twilio (used for both OTP auth codes and briefing SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=            # E.164 format e.g. +18005550100

# Market Data (fallback only — primary is yahoo-finance2, no key needed)
ALPHA_VANTAGE_API_KEY=

# JWT
JWT_SECRET=                     # Long random string. Generate with: openssl rand -hex 64
JWT_EXPIRY=30d                  # 30-day session tokens

# App
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

---

## Authentication Flow

### Sign Up (new user)
```
1. User enters name + phone on Welcome.jsx
2. POST /api/auth/request-otp { name, phone }
3. Server generates 6-digit code, saves to otp_codes (expires 10 min)
4. Server sends SMS via Twilio: "Your fire-pulse code: 849271"
5. User lands on Verify.jsx, enters code
6. POST /api/auth/verify-otp { phone, code }
7. Server checks: does code exist? is it expired? is it used? is it blocked?
8. If valid → create user in users table → mark code used
9. Server returns JWT (30-day expiry) + user object
10. Client stores JWT in memory + localStorage. Redirects to Dashboard.
```

### Sign In (returning user)
```
Same flow — step 8 finds existing user instead of creating one.
Updates last_login_at timestamp.
```

### OTP Security Rules (server/auth/otp.js)
```javascript
// Rules enforced on every verify attempt:
// 1. Code must exist for that phone number
// 2. expires_at must be in the future
// 3. used must be false
// 4. blocked must be false
// 5. Increment attempts on every failed verify
// 6. If attempts >= 5 within any 20-minute window → set blocked = true
//    Block lasts 24 hours (check created_at + 24h)
// 7. On success → set used = true, update users.last_login_at
```

### JWT Middleware (server/middleware/requireAuth.js)
```javascript
// Applied to every route except /api/auth/*
// Reads Authorization: Bearer <token> header
// Verifies signature using JWT_SECRET
// Checks expiry (30 days)
// Attaches req.userId for use in route handlers
// Returns 401 if missing, invalid, or expired
```

---

## Market Data Strategy (server/agent/marketData.js)

### Priority Order
```
1. Check price_cache table — if fetched_at > 15 min ago, use cached price
2. If stale/missing → fetch from yahoo-finance2 (primary, free, no limits)
3. If yahoo-finance2 fails → fetch from Alpha Vantage (fallback, rate-limited)
4. If both fail → log error, use last known price with a "stale data" flag
5. Save result to price_cache regardless of source
```

### yahoo-finance2 Usage
```javascript
import yahooFinance from 'yahoo-finance2';

// Single quote
const quote = await yahooFinance.quote('AAPL');
// Returns: { regularMarketPrice, regularMarketChangePercent, shortName, sector, ... }

// Batch quotes — fetch all unique tickers across all users in one call
const tickers = [...new Set(allHoldings.map(h => h.ticker))];
const quotes = await Promise.all(tickers.map(t => yahooFinance.quote(t)));
```

### Ticker Validation (used in Portfolio UI)
```javascript
// Called on every keystroke in TickerSearch component (debounced 400ms)
// GET /api/portfolio/validate?ticker=AAPL
// Server calls yahooFinance.quote(ticker)
// Returns: { valid: true, name: "Apple Inc.", sector: "Technology", price: 188.40 }
// Returns: { valid: false } if ticker not found
// Frontend shows green checkmark + auto-fills name/sector on valid
// Frontend shows red "ticker not found" on invalid
```

---

## Sentiment Data Strategy (server/agent/sentiment.js)

### StockTwits (Primary Retail Sentiment)
```javascript
// Free public API — no key required
// GET https://api.stocktwits.com/api/2/streams/symbol/{ticker}.json
// Returns last 30 messages with sentiment tags (Bullish/Bearish) per post
// Parse: count bullish vs bearish, extract top quoted messages

async function getStockTwitsSentiment(ticker) {
  const res = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${ticker}.json`);
  const data = await res.json();
  const messages = data.messages || [];
  const bullish = messages.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
  const bearish = messages.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;
  const total = bullish + bearish;
  return {
    bullishPct: total > 0 ? Math.round((bullish / total) * 100) : null,
    bearishPct: total > 0 ? Math.round((bearish / total) * 100) : null,
    topMessages: messages.slice(0, 3).map(m => m.body),
    available: total > 0
  };
}
// If StockTwits returns no data or errors → sentiment.available = false
// Agent prompt will note "no StockTwits data available for [ticker]"
```

### Reddit (Best Effort via Web Search)
```javascript
// Not a direct API call — Claude's web_search tool searches Reddit
// Targets: r/wallstreetbets, r/investing, r/stocks
// Included in the agent prompt as a search instruction
// If no results found → Claude explicitly states "no Reddit discussion found"
// Claude never fabricates Reddit sentiment
```

---

## Agent Orchestrator (server/agent/index.js)

Full pipeline run for a single user:

```javascript
async function runBriefingForUser(userId, briefingType) {
  // Create briefing row with status: 'pending'
  const briefingId = await createPendingBriefing(userId, briefingType);

  try {
    // 1. Load holdings
    const holdings = await getHoldings(userId);
    if (holdings.length === 0) return updateBriefing(briefingId, 'failed', { error_log: 'No holdings' });

    // 2. Fetch prices (cache-first, yahoo primary, AV fallback)
    const prices = await fetchPrices(holdings.map(h => h.ticker));

    // 3. Fetch StockTwits sentiment for top 5 holdings by value
    const topHoldings = getTopHoldings(holdings, prices, 5);
    const sentiment = await Promise.all(topHoldings.map(h => getStockTwitsSentiment(h.ticker)));

    // 4. Calculate portfolio metrics
    const metrics = calculateMetrics(holdings, prices);

    // 5. Take daily snapshot (AM only, once per day)
    if (briefingType === 'am') await maybeTakeSnapshot(userId, holdings, prices, metrics);

    // 6. Build and send prompt to Claude
    const prompt = buildBriefingPrompt(holdings, prices, sentiment, metrics, briefingType);
    const briefingContent = await callClaudeAgent(prompt);

    // 7. Save completed briefing
    await updateBriefing(briefingId, 'completed', {
      content_full: briefingContent.full,
      content_sms: briefingContent.sms,
      market_snapshot: prices
    });

    // 8. Send SMS
    const user = await getUser(userId);
    if (user.phone) await sendSMS(user.phone, briefingContent.sms);

  } catch (err) {
    // First failure → retry once after 5 minutes
    const briefing = await getBriefing(briefingId);
    if (briefing.retry_count === 0) {
      await updateBriefing(briefingId, 'pending', { retry_count: 1 });
      setTimeout(() => runBriefingForUser(userId, briefingType), 5 * 60 * 1000);
    } else {
      await updateBriefing(briefingId, 'failed', { error_log: err.message });
    }
  }
}
```

---

## Briefing Prompt Strategy (server/agent/briefingPrompt.js)

The prompt has two parts. Both matter equally.

### System Prompt — Identity, Rules, Tone
```javascript
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
`;
```

### User Prompt — The Actual Task
```javascript
function buildUserPrompt(holdings, prices, sentiment, metrics, briefingType) {
  const timeLabel = briefingType === 'am' ? 'PRE-MARKET MORNING' : 'MIDDAY';

  const holdingLines = holdings.map(h => {
    const p = prices[h.ticker];
    const stw = sentiment.find(s => s.ticker === h.ticker);
    const sentimentLine = stw?.available
      ? `StockTwits: ${stw.bullishPct}% bullish / ${stw.bearishPct}% bearish`
      : `StockTwits: no data`;
    return `${h.ticker} (${h.name}) — ${h.shares} shares @ $${p?.price ?? 'N/A'} ` +
           `(${p?.change_pct > 0 ? '+' : ''}${p?.change_pct?.toFixed(2) ?? '?'}% today) | ` +
           `P&L: ${metrics.pnl[h.ticker] > 0 ? '+' : ''}$${metrics.pnl[h.ticker]?.toFixed(0)} | ` +
           sentimentLine;
  }).join('\n');

  const sectorLines = Object.entries(metrics.sectorExposure)
    .map(([s, pct]) => `${s}: ${pct.toFixed(1)}%`).join(' | ');

  return `
Generate a ${timeLabel} briefing for this portfolio.

## Portfolio
Total Value: $${metrics.totalValue.toLocaleString()}
Day Change: ${metrics.dayChangePct >= 0 ? '+' : ''}${metrics.dayChangePct.toFixed(2)}%
Last portfolio sync: ${metrics.lastSyncDate}

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
`;
}
```

---

## Scheduler (server/scheduler/index.js)

```javascript
import cron from 'node-cron';
import { isMarketOpen, isMarketHoliday } from 'trading-calendars'; // or equivalent package
import { runBriefingForAllUsers } from '../agent/index.js';
import { sendSMS } from '../agent/sms.js';
import { getAllUsers } from '../db/client.js';

async function runOrSkip(briefingType) {
  const today = new Date();

  if (isMarketHoliday(today)) {
    // Send a "markets closed" text instead of a briefing
    const users = await getAllUsers();
    for (const user of users) {
      if (user.phone && user[`${briefingType}_briefing_enabled`]) {
        await sendSMS(user.phone, "🔥 fire-pulse: Market's taking a break today. Go touch grass (or be a degen elsewhere). See you tomorrow.");
      }
    }
    return;
  }

  await runBriefingForAllUsers(briefingType);
}

// 7:00 AM PST = 15:00 UTC (Mon–Fri)
cron.schedule('0 15 * * 1-5', () => runOrSkip('am'));

// 12:00 PM PST = 20:00 UTC (Mon–Fri)
cron.schedule('0 20 * * 1-5', () => runOrSkip('pm'));

// Nightly OTP cleanup at 2am UTC
cron.schedule('0 2 * * *', async () => {
  await supabase.from('otp_codes').delete().lt('expires_at', new Date().toISOString());
});
```

---

## API Routes

### Auth
```
POST /api/auth/request-otp    { name?, phone }
                               → Sends OTP via SMS. name required for new users only.

POST /api/auth/verify-otp     { phone, code }
                               → Verifies OTP. Returns { token, user } on success.
                               → Returns 429 if blocked, 401 if invalid/expired.
```

### Portfolio (all protected by requireAuth middleware)
```
GET    /api/portfolio              → Get all holdings for current user
POST   /api/portfolio              → Add a holding { ticker, shares, avg_cost, asset_type }
PUT    /api/portfolio/:id          → Update shares or avg_cost
DELETE /api/portfolio/:id          → Remove a holding

GET    /api/portfolio/validate     → ?ticker=AAPL
                                    → { valid: true, name, sector, price }
                                    → { valid: false } if not found

GET    /api/portfolio/snapshots    → Historical daily snapshots for value-over-time chart
```

### Briefings (all protected)
```
GET /api/briefings                 → Paginated history. ?type=am|pm&limit=20&offset=0
GET /api/briefings/latest          → Most recent AM + most recent PM briefing
```

### Agent (protected)
```
POST /api/agent/run                → { type: 'am'|'pm' } — manual trigger for testing
```

### Settings (protected)
```
GET  /api/settings                 → Returns user profile + preferences
PUT  /api/settings                 → Update name, am_briefing_enabled, pm_briefing_enabled
```

---

## Frontend Pages

### Welcome.jsx — Phone Entry
- Single input: phone number (auto-formats to E.164 as user types)
- Below phone: name field appears only if phone is not found (new user)
- CTA button: "Send me a code"
- No password. No email. That's it.

### Verify.jsx — OTP Entry
- 6 individual digit inputs (auto-advances on each keypress)
- "Didn't get it? Resend" link (available after 30 seconds)
- Shows error on wrong code: "That's not right — X attempts remaining"
- Shows blocked message: "Too many attempts. Try again in 24 hours."

### Dashboard.jsx
- 4 stat tiles: Portfolio Value | Day Change $ | Day Change % | # Holdings
- Latest AM briefing card (expandable)
- Latest PM briefing card (expandable)
- Sector exposure pie chart (Recharts)
- "Next briefing in: X hrs X min" countdown in topbar

### Portfolio.jsx
- Holdings table: Ticker | Name | Shares | Avg Cost | Current Price | Value | P&L | Sector
- **Add Holding flow:**
  1. User clicks "+ Add Holding"
  2. TickerSearch component appears — user types ticker
  3. After 400ms debounce → GET /api/portfolio/validate?ticker=X
  4. Valid: green ✅ + name + sector auto-fill
  5. Invalid: red ✗ "Ticker not found"
  6. User fills in shares + avg cost → Save
- Edit inline: click any row to edit shares/avg cost
- Delete: trash icon per row with confirm dialog
- "Last synced" timestamp above table

### History.jsx
- Chronological list of all briefings
- Filter bar: AM | PM | Date range
- Each briefing is a collapsible card showing full content
- Status badge: completed (green) | failed (red)

### Settings.jsx
- Display name (editable)
- AM briefing toggle
- PM briefing toggle
- "Send test SMS" button
- "Run briefing now" button (manual trigger)
- "Log out all sessions" button

---

## Design Direction

**Aesthetic:** Dark terminal meets trading desk. Deep navy-blacks, teal accent, monospace for data, display serif for big numbers. Bloomberg Terminal meets modern SaaS — professional and sharp without being sterile.

**Key details:**
- Sidebar nav (collapsible to icon-only)
- Sticky topbar with "Next briefing in: X hrs" live countdown
- Briefing cards: gradient top-bar accent, AM/PM badge, expandable body
- Holdings table: inline colored exposure bars per row
- Stat tiles: top-border color-coded (teal=positive, red=negative, gold=neutral)
- OTP input: 6 individual boxes, auto-advance, feels native

---

## Portfolio Data Philosophy

**fire-pulse never connects to any brokerage.** No OAuth, no Plaid, no Fidelity credentials. Users enter holdings manually. The agent tracks value and P&L automatically from live market prices.

**MVP:** Manual entry with live ticker validation
**V2:** CSV import supporting Fidelity, Schwab, and Robinhood export formats

If a user hasn't updated their holdings in a while, briefings show "Last synced: [date]" so they know the position data may not reflect recent trades.

If no portfolio snapshot exists for today, the agent uses the most recent available snapshot. A missing snapshot is not an error — it just means the chart has a gap for that day.

---

## Build Order

1. Scaffold monorepo — folders, package.json files, .env.example, .gitignore
2. Set up Supabase project — run 001_initial.sql migration
3. Build Express skeleton — index.js, requireAuth middleware, basic health route
4. Build auth system — otp.js, jwt.js, /api/auth routes, SMS sender
5. Build ticker validation endpoint — yahoo-finance2 integration
6. Build portfolio CRUD routes
7. Build market data layer — price cache + yahoo-finance2 + Alpha Vantage fallback
8. Build sentiment layer — StockTwits API + Reddit via web search
9. Build Claude agent — prompt builder + orchestrator + retry logic
10. Build scheduler — node-cron + market holiday check + OTP cleanup job
11. Build React frontend — Welcome → Verify → Dashboard → Portfolio → History → Settings
12. Build TickerSearch component with live validation
13. Wire frontend to backend — test full auth flow + portfolio entry + briefing trigger
14. Deploy to Render — web service + environment variables
15. End-to-end test: sign up → add holdings → trigger briefing → receive SMS

---

## First Command for Claude Code

Open Claude Code inside your fire-pulse repo and paste this:

> "Read CLAUDE_CODE_SPEC_v2.md in full before writing any code.
> This is the complete spec for fire-pulse — a multi-user financial intelligence agent.
> Start with Step 1 of the Build Order: scaffold the monorepo structure.
> Create the client/ and server/ folder structures exactly as shown in the spec,
> with package.json files listing all required dependencies, .env.example,
> and a .gitignore that excludes node_modules, .env, and dist.
> Do not write any application logic yet — structure and dependencies only."

---

## Post-MVP Roadmap (V2)

- CSV import — Fidelity, Schwab, Robinhood formats with diff preview modal
- X (Twitter) sentiment — requires paid API tier (~$100/mo), add when ready
- Email briefings — in addition to SMS
- Advisor/team view — one account, multiple portfolios
- Portfolio vs benchmark comparison — SPY, QQQ, sector ETFs
- Mobile app — React Native
