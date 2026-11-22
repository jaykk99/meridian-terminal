/** API surface for Meridian. Serves the SPA from the assets binding. */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { ensureSchema, findUser, newId, type Env, type UserRow } from './db';
import {
  ASSET_CLASSES,
  CLASS_LEVERAGE,
  INTERVALS,
  candlesFor,
  getDef,
  listSymbols,
  marketStatus,
  quoteFor,
  type AssetClass,
} from './market';
import {
  githubAuthorize,
  githubCallback,
  createGuest,
  currentUser,
  githubConfigured,
  logout,
  publicUser,
  requireUser,
  walletChallenge,
  walletLogin,
} from './auth';
import { buildPortfolio, closePosition, openPosition, round2 } from './trading';
import {
  bindSymbolIndex,
  copySubscriptions,
  getTrader,
  leaderboard,
  startCopy,
  stopCopy,
  syncCopies,
  traderPublic,
} from './copy';
import { brief, scan, signalFor } from './ai';
import { BASE_FEE_RATE, claimCool, sumCoolStats, tradeCool } from './sumcool';

bindSymbolIndex((cls: AssetClass) =>
  listSymbols()
    .filter((d) => d.assetClass === cls)
    .map((d) => d.symbol),
);

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  await ensureSchema(c.env);
  await next();
});

const json = (c: Context, data: unknown, status = 200) => c.json(data, status as 200);
const fail = (c: Context, message: string, status = 400) => c.json({ error: message }, status as 400);

async function currentAccount(c: Context<{ Bindings: Env }>): Promise<UserRow | null> {
  return currentUser(c);
}

/* ------------------------------------------------------------------ health */

app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return json(c, {
    ok: row?.ok === 1,
    markets: listSymbols().length,
    github: githubConfigured(c.env),
  });
});

/* -------------------------------------------------------------------- auth */

app.get('/api/auth/github', (c) => {
  if (!githubConfigured(c.env)) {
    return c.redirect('/?auth=unconfigured');
  }
  return githubAuthorize(c);
});

app.get('/api/auth/github/callback', async (c) => githubCallback(c));

app.post('/api/auth/guest', async (c) => {
  const user = await createGuest(c);
  return json(c, { user: publicUser(user) });
});

app.post('/api/auth/wallet/challenge', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { address?: string };
  const result = await walletChallenge(c, body.address ?? '');
  if (result.error) return fail(c, result.error);
  return json(c, { message: result.message });
});

app.post('/api/auth/wallet', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    address?: string;
    signature?: string;
  };
  const result = await walletLogin(c, body.address ?? '', body.signature ?? '');
  if (result.error) return fail(c, result.error);
  return json(c, { user: publicUser(result.user as UserRow) });
});

app.post('/api/auth/logout', async (c) => {
  await logout(c);
  return json(c, { ok: true });
});

app.get('/api/config', (c) =>
  json(c, {
    // Public client identifiers only — never secrets.
    walletConnectProjectId: c.env.WALLETCONNECT_PROJECT_ID?.trim() || null,
    githubConfigured: githubConfigured(c.env),
    baseFeeRate: BASE_FEE_RATE,
  }),
);

app.get('/api/me', async (c) => {
  const user = await currentAccount(c);
  return json(c, {
    user: user ? publicUser(user) : null,
    githubConfigured: githubConfigured(c.env),
  });
});

/* ------------------------------------------------------------------ markets */

app.get('/api/market/symbols', (c) => {
  const defs = listSymbols().map((d) => ({
    symbol: d.symbol,
    name: d.name,
    assetClass: d.assetClass,
    maxLeverage: CLASS_LEVERAGE[d.assetClass],
    marketStatus: marketStatus(d.assetClass),
  }));
  return json(c, { classes: ASSET_CLASSES, symbols: defs, intervals: Object.keys(INTERVALS) });
});

app.get('/api/market/quotes', (c) => {
  const requested = c.req.query('symbols');
  const defs = requested
    ? requested
        .split(',')
        .map((s) => getDef(s.trim()))
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
    : listSymbols();
  const spark = c.req.query('spark') !== '0';
  return json(c, {
    at: Date.now(),
    quotes: defs.map((d) => quoteFor(d, Date.now(), spark ? 24 : 0)),
  });
});

app.get('/api/market/candles', (c) => {
  const symbol = c.req.query('symbol') ?? '';
  const def = getDef(symbol);
  if (!def) return fail(c, 'Unknown market.', 404);
  const interval = c.req.query('interval') ?? '1h';
  if (!INTERVALS[interval]) return fail(c, 'Unknown interval.', 400);
  const limit = Number(c.req.query('limit') ?? 180);
  return json(c, {
    symbol: def.symbol,
    interval,
    candles: candlesFor(def, interval, limit),
  });
});

app.get('/api/market/overview', (c) => {
  const now = Date.now();
  const quotes = listSymbols().map((d) => quoteFor(d, now, 0));
  const byClass = ASSET_CLASSES.map((cls) => {
    const group = quotes.filter((q) => q.assetClass === cls);
    const avg = group.reduce((sum, q) => sum + q.change24h, 0) / (group.length || 1);
    return {
      assetClass: cls,
      count: group.length,
      avgChange: Math.round(avg * 100) / 100,
      volume: Math.round(group.reduce((sum, q) => sum + q.volume, 0)),
      advancing: group.filter((q) => q.change24h > 0).length,
      declining: group.filter((q) => q.change24h < 0).length,
    };
  });
  const sorted = [...quotes].sort((a, b) => b.change24h - a.change24h);
  const tickerSymbols = [
    'BTCUSD',
    'ETHUSD',
    'SOLUSD',
    'SPX',
    'NDX',
    'NVDA',
    'AAPL',
    'TSLA',
    'EURUSD',
    'XAUUSD',
    'WTI',
    'COPPER',
  ];
  const ticker = tickerSymbols
    .map((s) => quotes.find((q) => q.symbol === s))
    .filter((q): q is NonNullable<typeof q> => Boolean(q));
  return json(c, {
    at: now,
    totalMarkets: quotes.length,
    totalVolume: Math.round(quotes.reduce((sum, q) => sum + q.volume, 0)),
    advancing: quotes.filter((q) => q.change24h > 0).length,
    declining: quotes.filter((q) => q.change24h < 0).length,
    byClass,
    gainers: sorted.slice(0, 5),
    losers: sorted.slice(-5).reverse(),
    ticker,
  });
});

/* ---------------------------------------------------------------- portfolio */

async function loadPortfolio(c: Context<{ Bindings: Env }>, user: UserRow) {
  await syncCopies(c.env, user);
  return buildPortfolio(c.env, user);
}

app.get('/api/portfolio', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to open a portfolio.', 401);
  return json(c, await loadPortfolio(c, user));
});

app.post('/api/orders', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to trade.', 401);
  let body: {
    symbol?: string;
    side?: string;
    margin?: number;
    leverage?: number;
    tp?: number | null;
    sl?: number | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'Invalid request body.');
  }
  if (!body.symbol) return fail(c, 'Missing market.');
  const side = body.side === 'short' ? 'short' : 'long';
  const result = await openPosition(c.env, user, {
    symbol: body.symbol,
    side,
    margin: Number(body.margin),
    leverage: Number(body.leverage),
    tp: body.tp ?? null,
    sl: body.sl ?? null,
  });
  if (result.error) return fail(c, result.error);
  return json(c, { position: result.position, portfolio: await loadPortfolio(c, user) });
});

app.post('/api/orders/:id/close', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to trade.', 401);
  const result = await closePosition(c.env, user.id, c.req.param('id'));
  if (result.error) return fail(c, result.error);
  return json(c, { pnl: result.pnl, portfolio: await loadPortfolio(c, user) });
});

/* ---------------------------------------------------------------- watchlist */

app.get('/api/watchlist', async (c) => {
  const user = await currentAccount(c);
  if (!user) return json(c, { symbols: [] });
  const rows = await c.env.DB.prepare(
    'SELECT symbol FROM watchlist WHERE user_id = ? ORDER BY created_at DESC',
  )
    .bind(user.id)
    .all<{ symbol: string }>();
  return json(c, { symbols: rows.results.map((r) => r.symbol) });
});

app.post('/api/watchlist', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to save a watchlist.', 401);
  const body = (await c.req.json().catch(() => ({}))) as { symbol?: string };
  const def = getDef(body.symbol ?? '');
  if (!def) return fail(c, 'Unknown market.');
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO watchlist (user_id, symbol, created_at) VALUES (?, ?, ?)',
  )
    .bind(user.id, def.symbol, Date.now())
    .run();
  return json(c, { ok: true, symbol: def.symbol });
});

app.delete('/api/watchlist/:symbol', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to save a watchlist.', 401);
  await c.env.DB.prepare('DELETE FROM watchlist WHERE user_id = ? AND symbol = ?')
    .bind(user.id, c.req.param('symbol').toUpperCase())
    .run();
  return json(c, { ok: true });
});

/* --------------------------------------------------------------------- copy */

app.get('/api/copy/traders', async (c) => {
  const board = leaderboard();
  const user = await currentAccount(c);
  const subscribed = new Set<string>();
  if (user) {
    const rows = await c.env.DB.prepare(
      "SELECT trader_id FROM copies WHERE user_id = ? AND status = 'active'",
    )
      .bind(user.id)
      .all<{ trader_id: string }>();
    for (const row of rows.results) subscribed.add(row.trader_id);
  }
  return json(c, {
    traders: board.map((t) => ({ ...t, copying: subscribed.has(t.id) })),
  });
});

app.get('/api/copy/traders/:id', (c) => {
  const trader = getTrader(c.req.param('id'));
  if (!trader) return fail(c, 'Unknown trader.', 404);
  return json(c, traderPublic(trader));
});

app.get('/api/copy/mine', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to copy traders.', 401);
  await syncCopies(c.env, user);
  const subscriptions = await copySubscriptions(c.env, user.id);
  const portfolio = await buildPortfolio(c.env, user);
  return json(c, {
    subscriptions,
    copies: portfolio.openPositions.filter((p) => p.source === 'copy'),
    equity: portfolio.equity,
    freeCash: portfolio.freeCash,
  });
});

app.post('/api/copy', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to copy traders.', 401);
  const body = (await c.req.json().catch(() => ({}))) as {
    traderId?: string;
    allocation?: number;
  };
  if (!body.traderId) return fail(c, 'Pick a trader.');
  const result = await startCopy(c.env, user, body.traderId, Number(body.allocation));
  if (result.error) return fail(c, result.error);
  await syncCopies(c.env, user);
  return json(c, {
    id: result.id,
    subscriptions: await copySubscriptions(c.env, user.id),
    portfolio: await buildPortfolio(c.env, user),
  });
});

app.post('/api/copy/:id/stop', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to copy traders.', 401);
  const result = await stopCopy(c.env, user.id, c.req.param('id'));
  if (result.error) return fail(c, result.error);
  return json(c, {
    subscriptions: await copySubscriptions(c.env, user.id),
    portfolio: await buildPortfolio(c.env, user),
  });
});

/* ----------------------------------------------------------------------- ai */

app.get('/api/ai/scanner', (c) => {
  const signals = scan();
  return json(c, { at: Date.now(), signals, brief: brief() });
});

app.get('/api/ai/signal/:symbol', (c) => {
  const def = getDef(c.req.param('symbol'));
  if (!def) return fail(c, 'Unknown market.', 404);
  return json(c, signalFor(def));
});

app.get('/api/ai/brief', (c) => json(c, brief()));

/* ---------------------------------------------------------------- sum cool */

app.get('/api/sumcool', async (c) => {
  const user = await currentAccount(c);
  return json(c, await sumCoolStats(c.env, user ?? undefined));
});

app.post('/api/sumcool/claim', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to claim Sum Cool.', 401);
  const result = await claimCool(c.env, user);
  if (result.error) return fail(c, result.error);
  const fresh = (await findUser(c.env, user.id)) ?? user;
  return json(c, {
    amount: result.amount,
    stats: await sumCoolStats(c.env, fresh),
    user: publicUser(fresh),
  });
});

app.post('/api/sumcool/trade', async (c) => {
  const user = await currentAccount(c);
  if (!user) return fail(c, 'Sign in to trade Sum Cool.', 401);
  const body = (await c.req.json().catch(() => ({}))) as {
    action?: string;
    usd?: number;
    amount?: number;
  };
  if (body.action !== 'buy' && body.action !== 'sell') return fail(c, 'Unknown action.');
  const result = await tradeCool(c.env, user, body.action, Number(body.usd), Number(body.amount));
  if (result.error) return fail(c, result.error);
  const fresh = (await findUser(c.env, user.id)) ?? user;
  return json(c, {
    tokens: result.tokens,
    proceeds: result.proceeds,
    price: result.price,
    stats: await sumCoolStats(c.env, fresh),
    user: publicUser(fresh),
  });
});

/* -------------------------------------------------------------------- misc */

app.get('/api/meta', async (c) => {
  const user = await currentAccount(c);
  const copyCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM copies WHERE status = 'active'",
  ).first<{ n: number }>();
  return json(c, {
    markets: listSymbols().length,
    classes: ASSET_CLASSES.length,
    githubConfigured: githubConfigured(c.env),
    copiers: copyCount?.n ?? 0,
    user: user ? publicUser(user) : null,
    serverTime: Date.now(),
    sessionId: newId('anon').slice(-6),
  });
});

app.all('/api/*', (c) => fail(c, 'Not found.', 404));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  console.error('unhandled', err);
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Something went wrong. Try again.' }, 500);
  }
  return c.text('Server error', 500);
});

export default app;
export { round2 };
