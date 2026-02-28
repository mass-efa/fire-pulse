# fire-pulse — Claude Code Instructions

## Read This First
Before doing anything else, read `CLAUDE_CODE_SPEC_v2.md` in full.
That file is the source of truth for all architecture, database, auth,
agent logic, and build decisions. If something isn't in the spec, ask
before assuming.

---

## Planning & Approval

For small, contained tasks: just do it. No plan needed.

For tasks that cross system boundaries or touch multiple systems at once:
- Briefly outline your approach before starting (2-5 lines is enough)
- Then proceed without waiting for approval

Stop and ask only when:
- You hit something the spec doesn't cover
- You need to make a tradeoff between two valid approaches
- Something would require changes to the DB schema or .env.example
- Something could break existing working functionality

After completing a logical chunk of work, give a short summary of
what you did and what's next — don't ask permission to continue,
just keep me informed so I can follow along.

---

## Architecture Rules

- The spec is the authority. Do not deviate from it without asking.
- **Auth:** Custom phone OTP + JWT only. No Supabase Auth. No email/password.
- **Market data:** yahoo-finance2 is primary. Alpha Vantage is fallback only.
- **Sentiment:** StockTwits API for primary retail sentiment. Reddit via web search, best effort.
- **Portfolio entry:** Manual ticker entry with live Yahoo Finance validation. No CSV import in MVP.
- **Database:** Supabase PostgreSQL only. Schema is defined in `server/db/migrations/001_initial.sql`.
- **No Supabase Auth** — do not use `auth.users` or any Supabase Auth helpers.

---

## Dependency Rules

- Do not install any package not listed in the spec without asking first
- Do not use `sudo npm install`
- Always install to the correct folder — server dependencies go in `server/`, client dependencies go in `client/`

---

## Code Quality Rules

- Write clean, readable code with comments on anything non-obvious
- Keep route handlers thin — business logic belongs in dedicated modules
- Every async function must have try/catch error handling
- Never hardcode secrets, API keys, or phone numbers — always use environment variables from `.env`
- Environment variable names must match `.env.example` exactly

---

## Git Rules

- Do not run `git commit` or `git push` automatically — always ask me first
- Suggest a commit message following this format:
  - `feat:` new feature
  - `fix:` bug fix
  - `chore:` setup, config, dependencies
  - `docs:` documentation only
- Keep commits focused — one logical change per commit

---

## Communication Rules

- If you're unsure about any decision, ask — don't assume
- If something in the spec seems contradictory, flag it before proceeding
- If a task would require a package, approach, or pattern not covered in the spec, surface it and wait for a decision
- Keep explanations concise — I want to understand what you're doing but don't need a lecture on every line

---

## Build Order (reference)

Follow this order from the spec. Do not skip ahead.

1. Scaffold monorepo — folders, package.json files, .env.example, .gitignore
2. Supabase setup — run 001_initial.sql migration
3. Express skeleton — index.js, requireAuth middleware, health route
4. Auth system — otp.js, jwt.js, /api/auth routes, SMS sender
5. Ticker validation endpoint — yahoo-finance2 integration
6. Portfolio CRUD routes
7. Market data layer — price cache + yahoo-finance2 + Alpha Vantage fallback
8. Sentiment layer — StockTwits API + Reddit via web search
9. Claude agent — prompt builder + orchestrator + retry logic
10. Scheduler — node-cron + market holiday check + OTP cleanup
11. React frontend — Welcome → Verify → Dashboard → Portfolio → History → Settings
12. TickerSearch component with live validation
13. Wire frontend to backend — test full auth + portfolio + briefing trigger
14. Deploy to Render
15. End-to-end test: sign up → add holdings → trigger briefing → receive SMS
