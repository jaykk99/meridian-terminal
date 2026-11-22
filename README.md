# Meridian Terminal

An AI-native **paper-trading** terminal across crypto, US equities, FX, indices, commodities and ETFs — with an AI signal desk, copy trading, and its own in-app token, **Sum Cool (COOL)**.

> Meridian is a simulation. Prices are synthetic and deterministic, orders never reach a real venue, and nothing here is investment advice. No deposits, withdrawals or real money are involved.

## What's inside

- **340+ markets across six asset classes**, each with live simulated quotes, candles at five intervals, 24h stats and per-class leverage limits.
- **AI signal desk** — a five-model ensemble (trend, structure, momentum, RSI, range) scores every market with confidence, targets, invalidation and reasoning, plus a market-wide scanner and brief.
- **Copy trading** — 16 strategy desks with live books, risk scores, modelled 30-day returns and automatic mirroring into your account.
- **Portfolio** — equity curve, open positions, trade history, win rate, exposure and max drawdown computed from your own fills.
- **Sum Cool (COOL)** — free one-time claim of 500 COOL, spot buy/sell, fixed 100M supply, and fee tiers: 500 COOL = 25% off, 1,500 = 50% off, 5,000 = **0% fees**. Base fee is 0.005%.
- **Sign-in options** — GitHub OAuth, instant guest sessions, and Trust Wallet (injected provider or WalletConnect QR pairing) with server-verified signatures.

## Stack

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| Frontend | React 19, Vite 6, TypeScript, hand-written CSS             |
| Backend  | Hono on a Cloudflare Worker                                |
| Storage  | Cloudflare D1 (SQLite); schema bootstraps on first request |
| Wallet   | EIP-1193 / EIP-6963 injected provider, WalletConnect v2    |
| Signing  | EIP-191 `personal_sign` verified server-side with `viem`   |

## Quick start

Requirements: [Bun](https://bun.sh) 1.2+ (the project uses `bun.lock`). No Cloudflare account is needed for local development — Wrangler runs a simulated local D1 database.

```bash
bun install
bun run preview:worker
```

Open **http://localhost:3000**.

`preview:worker` builds the frontend into `dist/` and starts `wrangler dev` on port 3000 with the API, assets and a local D1 database. The database is created automatically on the first API request and persisted under `.wrangler/`.

### Development loops

| Command                 | What it does                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| `bun run preview:worker`| Build the SPA, then serve app + API + local D1 at `:3000` (recommended)         |
| `bun run dev`           | Vite dev server at `:5173` for UI work only — no `/api` routes behind it        |
| `bun run build`         | Build the SPA into `dist/`                                                       |
| `bun run typecheck`     | Type-check the app and the Worker                                                       |
| `bun run build:worker`  | `wrangler deploy --dry-run`, which validates the Worker bundle                  |

The Worker serves the built assets from `dist/`, so after changing frontend code rebuild (`bun run build`) and restart the Worker (or just re-run `preview:worker`). For pure UI iteration, `bun run dev` gives hot reload; point its API calls at a Worker by adding a Vite proxy if you need both.

To reset local data, stop the server and delete `.wrangler/`.

## Configuration

Everything optional is read from Worker environment variables. For local development put them in a **`.dev.vars`** file at the repo root (already git-ignored):

```ini
# Optional — enables "Continue with GitHub"
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret

# Optional — enables WalletConnect QR pairing
WALLETCONNECT_PROJECT_ID=your_reown_project_id
```

| Variable                   | Required | Purpose                                                                                                       |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `GITHUB_CLIENT_ID`         | No       | GitHub OAuth app client id. Without it the GitHub button reports that sign-in is not configured.               |
| `GITHUB_CLIENT_SECRET`     | No       | GitHub OAuth app secret, used for the token exchange.                                                          |
| `WALLETCONNECT_PROJECT_ID` | No       | Public Reown project id for WalletConnect v2 QR pairing. Served to the browser via `/api/config`; not a secret. |
| `APP_ORIGIN`               | No       | Canonical origin used for OAuth callbacks and cookies. Defaults to the request origin.                          |

Guest sign-in and the injected Trust Wallet provider work with **no configuration at all**.

### GitHub OAuth

1. Create an OAuth app at **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Homepage URL: your origin (e.g. `http://localhost:3000`).
3. Authorization callback URL: `<origin>/api/auth/github/callback`.
4. Put the client id and secret in `.dev.vars` (local) or as Worker secrets (deployed).

### WalletConnect QR

1. Create a project at [Reown Cloud](https://cloud.reown.com) and copy its project id.
2. Set `WALLETCONNECT_PROJECT_ID` in `.dev.vars` or as a Worker variable.
3. Open **Sign in → Trust Wallet → Scan QR code** and scan it with Trust Wallet on your phone.

The injected Trust Wallet path (`window.trustwallet.ethereum` or any EIP-6963 provider) needs no project id.

## Deploy to Cloudflare

```bash
bunx wrangler login
bunx wrangler d1 create meridian-db     # copy the returned database_id
```

Replace the placeholder `database_id` in `wrangler.jsonc` with the real one, then:

```bash
bun run build
bunx wrangler deploy
```

Set the optional configuration as Worker secrets/variables:

```bash
bunx wrangler secret put GITHUB_CLIENT_ID
bunx wrangler secret put GITHUB_CLIENT_SECRET
bunx wrangler secret put WALLETCONNECT_PROJECT_ID   # optional
```

The D1 schema is created lazily on the first API request, so no migration step is required. `wrangler.jsonc` already configures the `ASSETS` binding with SPA fallback and `nodejs_compat`.

## Project layout

```
src/
  pages/        Landing, Markets, Trade, Portfolio, Copy, AI desk, Sum Cool
  components/   Layout, auth modal, candle chart, sparkline, icons, UI bits
  lib/          API client, hash-free router, wallet + WalletConnect, formatting
worker/
  index.ts      Hono routes, API middleware, SPA fallback
  market.ts     Instrument universe and deterministic synthetic price engine
  trading.ts    Orders, positions, fees and portfolio maths
  copy.ts       Strategy desks, event generation and mirroring
  ai.ts         Signal ensemble, scanner and market brief
  sumcool.ts    COOL claim, spot book, balances and fee tiers
  auth.ts       GitHub OAuth, guest sessions, wallet challenge/login
  db.ts         D1 schema bootstrap, Env type and row helpers
```

## Good to know

- **Fees:** 0.005% base on entry and exit, discounted automatically by COOL holdings. Copy-trade entries skip the fee.
- **Leverage:** isolated margin per position with per-class caps; liquidation price is shown on the ticket.
- **Sum Cool:** claim and trade actions are tracked in `token_claims` and `token_ledger`; one claim per account. COOL is entirely in-app — no blockchain, no transfer, no cash value.
- **No test suite yet.** `bun run typecheck` and `bun run build` are the checks that run in CI-less development.
