# 🔥 fire-pulse

> An AI-powered financial intelligence agent that monitors your portfolio, analyzes market conditions, and delivers twice-daily briefings straight to your phone.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Claude AI](https://img.shields.io/badge/Claude-AI_Agent-CC785C?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Twilio](https://img.shields.io/badge/Twilio-SMS-F22F46?style=flat-square&logo=twilio&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## What is fire-pulse?

fire-pulse is a full-stack agentic application that acts as your personal financial analyst. Twice a day — at **7:00 AM** and **12:00 PM PST** — an AI agent wakes up, pulls live market data, scans analyst coverage and retail sentiment, and sends you a structured briefing via SMS so you can take action before markets move.

Briefings are direct, sourced, and written with a bit of personality — think r/investing meets Bloomberg, not a boring disclaimer-bot.

It's built to be **multi-user** — you can invite others to create their own accounts, manage their own portfolios, and receive their own personalized briefings.

---

## Features

### 🤖 AI Analysis Agent
- Powered by **Claude (Anthropic)** with live web search enabled
- Pulls from **Bloomberg, Yahoo Finance, and Seeking Alpha** for institutional coverage
- Pulls from **StockTwits and Reddit** (r/wallstreetbets, r/investing, r/stocks) for retail sentiment
- Only cites sources it actually found — never fabricates data, ratings, or price targets
- Shows its math on any non-trivial calculation (sentiment scores, concentration risk, etc.)
- Written with personality: confident, direct, occasionally dry — never boring

### 📊 Portfolio Manager
- **No brokerage connection required** — fire-pulse never touches your Fidelity, Schwab, or Robinhood account
- Add holdings manually with **live ticker validation** — type a ticker, get instant confirmation with company name and sector auto-filled from Yahoo Finance
- Supports: US stocks, ETFs, crypto, options, bonds, international equities
- The agent tracks value, P&L, and sector exposure automatically using live market data
- "Last synced" timestamp on every briefing so you always know how fresh the data is

### 📱 SMS Briefings (via Twilio)
- Scheduled at **7:00 AM PST** (pre-market) and **12:00 PM PST** (midday)
- Market holidays handled — you get a message, just not a briefing
- Concise, action-focused format designed for mobile reading
- Toggle AM and/or PM briefings independently
- Full briefing also readable on the web dashboard

### 🔐 Phone-Based Authentication
- No passwords, no email — just your phone number
- Sign up or log in by entering your phone number and a 6-digit SMS code
- Codes expire in 10 minutes, sessions last 30 days
- Brute-force protected: 5 failed attempts triggers a 24-hour block

### 👥 Multi-User
- Each user has their own isolated portfolio, preferences, and briefing history
- Invite anyone — they sign up with their own phone number

### 🗂️ Briefing History
- Full archive of every AM/PM briefing
- Filterable by date and briefing type
- Status tracking: completed, failed, retried

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Tailwind CSS, Recharts |
| **Backend** | Node.js, Express |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Custom phone OTP + JWT (no Supabase Auth) |
| **AI Agent** | Anthropic Claude API (`claude-sonnet-4-20250514`) + web search |
| **Market Data** | yahoo-finance2 (primary, free) + Alpha Vantage (fallback) |
| **Retail Sentiment** | StockTwits API + Reddit via web search |
| **SMS** | Twilio Programmable Messaging |
| **Scheduler** | node-cron + market holiday detection |
| **Deployment** | Render.com |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         fire-pulse                           │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │  React   │    │   Express    │    │     Supabase       │  │
│  │ Dashboard│◄──►│   API +      │◄──►│  (PostgreSQL DB)   │  │
│  │          │    │ JWT Auth     │    │                    │  │
│  └──────────┘    └──────┬───────┘    └────────────────────┘  │
│                         │                                    │
│                  ┌──────▼────────┐                           │
│                  │   AI Agent    │                           │
│                  │   (Claude)    │                           │
│                  │  + Web Search │                           │
│                  └──────┬────────┘                           │
│                         │                                    │
│        ┌────────────────┼──────────────────┐                 │
│        ▼                ▼                  ▼                 │
│  ┌───────────┐   ┌────────────┐   ┌─────────────────┐        │
│  │yahoo-fin2 │   │ StockTwits │   │     Twilio      │        │
│  │+ AV fallbk│   │ + Reddit   │   │  (OTP + SMS)    │        │
│  └───────────┘   └────────────┘   └─────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) account (free)
- An [Anthropic](https://console.anthropic.com) API key
- A [Twilio](https://twilio.com) account (free trial available)
- An [Alpha Vantage](https://www.alphavantage.co) API key (free, used as fallback only)

### 1. Clone the repo

```bash
git clone https://github.com/mass-efa/fire-pulse.git
cd fire-pulse
```

### 2. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
ANTHROPIC_API_KEY=your_key_here

SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_key
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

ALPHA_VANTAGE_API_KEY=your_key_here

JWT_SECRET=generate_with_openssl_rand_hex_64
JWT_EXPIRY=30d

PORT=3001
CLIENT_URL=http://localhost:5173
```

### 4. Set up the database

Run the migration in your Supabase SQL editor:

```bash
# File located at:
server/db/migrations/001_initial.sql
```

### 5. Run locally

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
fire-pulse/
├── client/
│   └── src/
│       ├── pages/           # Welcome, Verify, Dashboard, Portfolio, History, Settings
│       ├── components/      # Layout, TickerSearch, BriefingCard, ExposureChart, StatTile
│       ├── hooks/           # useAuth, usePortfolio
│       └── lib/             # Supabase client, Axios API instance
│
├── server/
│   ├── auth/                # OTP generation/verification, JWT signing
│   ├── middleware/          # requireAuth JWT middleware
│   ├── routes/              # auth, portfolio, briefings, agent
│   ├── agent/               # Claude orchestrator, market data, sentiment, SMS, prompt builder
│   ├── scheduler/           # node-cron jobs + market holiday detection
│   └── db/                  # Supabase client + migrations
│
├── .env.example
└── README.md
```

---

## Deploying to Render

1. Push your repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com) pointed at your repo
3. Add all environment variables from `.env`
4. Render runs the node-cron scheduler inside the same process — no separate cron service needed

---

## Roadmap

- [x] Phone OTP authentication
- [x] Live ticker validation on portfolio entry
- [x] StockTwits + Reddit sentiment
- [x] Market holiday detection
- [x] Briefing retry + error logging
- [ ] CSV import — Fidelity, Schwab, Robinhood (V2)
- [ ] X (Twitter) sentiment — pending viable free API tier
- [ ] Email briefings (in addition to SMS)
- [ ] Advisor view — manage multiple portfolios under one account
- [ ] Portfolio vs benchmark comparison (SPY, QQQ)
- [ ] Mobile app (React Native)

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

---

## License

MIT
