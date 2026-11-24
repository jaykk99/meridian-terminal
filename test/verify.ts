// Verification suite for meridian-terminal. No test framework, no network:
// run with `bun test/verify.ts` (bun is the project's runtime). Exits
// non-zero when any check fails.
import { listSymbols, getDef, priceAt, roundPrice } from '../worker/market.ts';
import {
  openPosition,
  closePosition,
  buildPortfolio,
  pnlFor,
  liquidationFor,
  syncPositions,
} from '../worker/trading.ts';
import { rsi } from '../worker/ai.ts';
import { BASE_FEE_RATE } from '../worker/sumcool.ts';
import { affordableMargin } from '../src/lib/format.ts';
import { readFileSync } from 'node:fs';

// ---------- minimal in-memory D1 stand-in ----------
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {
  users: [], positions: [], token_balances: [], token_claims: [], token_ledger: [],
  sessions: [], copies: [], watchlist: [], chat_messages: [], wallet_challenges: [],
};
function norm(sql: string) { return sql.replace(/\s+/g, ' ').trim(); }

class Stmt {
  constructor(public sql: string, public params: any[] = []) {}
  bind(...p: any[]) { return new Stmt(this.sql, p); }
  first<T>(): T | null {
    const s = norm(this.sql); const p = this.params;
    if (/SELECT COUNT\(\*\) AS n FROM positions WHERE user_id = \? AND status = 'open'/.test(s)) {
      return { n: tables.positions.filter(r => r.user_id === p[0] && r.status === 'open').length } as T;
    }
    if (/SELECT COUNT\(\*\) AS n FROM token_balances WHERE amount > 0/.test(s)) {
      return { n: tables.token_balances.filter(r => r.amount > 0).length } as T;
    }
    if (/SELECT COUNT\(\*\) AS n FROM copies WHERE status = 'active'/.test(s)) {
      return { n: tables.copies.filter(r => r.status === 'active').length } as T;
    }
    if (/SELECT \* FROM users WHERE id = \?/.test(s)) return (tables.users.find(r => r.id === p[0]) ?? null) as T;
    if (/SELECT \* FROM positions WHERE id = \? AND user_id = \?/.test(s)) return (tables.positions.find(r => r.id === p[0] && r.user_id === p[1]) ?? null) as T;
    if (/SELECT amount FROM token_balances WHERE user_id = \?/.test(s)) return (tables.token_balances.find(r => r.user_id === p[0]) ?? null) as T;
    if (/SELECT amount FROM token_claims WHERE user_id = \?/.test(s)) return (tables.token_claims.find(r => r.user_id === p[0]) ?? null) as T;
    if (/SELECT 1 AS ok/.test(s)) return { ok: 1 } as T;
    throw new Error('first() unhandled: ' + s);
  }
  all<T>(): { results: T[] } {
    const s = norm(this.sql); const p = this.params;
    if (/SELECT \* FROM positions WHERE user_id = \? AND status = 'open'/.test(s)) {
      let rows = tables.positions.filter(r => r.user_id === p[0] && r.status === 'open');
      if (/ORDER BY opened_at DESC/.test(s)) rows = [...rows].sort((a, b) => b.opened_at - a.opened_at);
      return { results: rows as T[] };
    }
    if (/SELECT \* FROM positions WHERE user_id = \? AND status = 'closed'/.test(s)) {
      let rows = tables.positions.filter(r => r.user_id === p[0] && r.status === 'closed').sort((a, b) => b.closed_at - a.closed_at);
      const m = s.match(/LIMIT (\d+)/); if (m) rows = rows.slice(0, +m[1]);
      return { results: rows as T[] };
    }
    if (/FROM token_ledger l JOIN users u/.test(s)) return { results: [] as T[] };
    throw new Error('all() unhandled: ' + s);
  }
  async run(): Promise<void> {
    const s = norm(this.sql); const p = this.params;
    if (/^ALTER TABLE/.test(s)) return;
    if (/^CREATE TABLE/.test(s) || /^CREATE (UNIQUE )?INDEX/.test(s)) return;
    if (/^UPDATE users SET balance = balance - \? WHERE id = \?/.test(s)) {
      const u = tables.users.find(r => r.id === p[1]); if (u) u.balance -= p[0]; return;
    }
    if (/^UPDATE users SET balance = balance \+ \? WHERE id = \?/.test(s)) {
      const u = tables.users.find(r => r.id === p[1]); if (u) u.balance += p[0]; return;
    }
    if (/^INSERT INTO positions/.test(s)) {
      const cols = ['id','user_id','symbol','side','qty','entry_price','leverage','margin','notional','fee','tp','sl','source','trader_id','trader_name','close_after','opened_at'];
      const row: Row = { status: 'open', close_price: null, realized_pnl: 0, closed_at: null };
      cols.forEach((c, i) => row[c] = p[i]); tables.positions.push(row); return;
    }
    if (/^UPDATE positions SET status = 'closed'/.test(s)) {
      const row = tables.positions.find(r => r.id === p[3] && r.user_id === p[4]);
      if (row) { row.close_price = p[0]; row.realized_pnl = p[1]; row.closed_at = p[2]; row.status = 'closed'; } return;
    }
    throw new Error('run() unhandled: ' + s);
  }
}

const env: any = {
  DB: {
    prepare: (sql: string) => new Stmt(sql),
    batch: async (stmts: Stmt[]) => { for (const st of stmts) await st.run(); },
  },
  ASSETS: { fetch: async () => new Response('ok') },
};

tables.users.push({ id: 'u_test', github_id: null, login: 'test', name: 'Test', avatar_url: null, wallet_address: null, is_guest: 0, balance: 100000, starting_balance: 100000, created_at: Date.now() - 1000 });
const user: any = tables.users[0];

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? pass++ : fail++;
}

// --- fee accounting: realised PnL is net of fees, curve has no fee jump ---
{
  const before = user.balance;
  const opened = await openPosition(env, user, { symbol: 'BTCUSD', side: 'long', margin: 10000, leverage: 20, tp: null, sl: null });
  check('open fills', !!opened.position, opened.error ?? '');
  const openFee = 10000 * 20 * BASE_FEE_RATE;
  check('open fee debited', Math.abs(user.balance - (before - 10000 - openFee)) < 0.01, `balance ${user.balance}`);
  const closed = await closePosition(env, user.id, opened.position!.id);
  const closeFee = 10000 * 20 * BASE_FEE_RATE;
  const actualChange = user.balance - before;
  check('balance change is net of both fees', Math.abs(actualChange - (-openFee - closeFee)) < 1.0, `actual ${actualChange.toFixed(2)}`);
  check('recorded realised PnL equals net balance change', Math.abs((closed.pnl ?? 999) - actualChange) < 1.0, `recorded ${closed.pnl}, actual ${actualChange.toFixed(2)}`);
  const pf = await buildPortfolio(env, user);
  const curvePrev = pf.curve[pf.curve.length - 2].v;
  check('equity curve running sum matches equity', Math.abs(curvePrev - pf.equity) < 0.01, `curve ${curvePrev}, equity ${pf.equity}`);
  check('portfolio realised PnL equals net change', Math.abs(pf.realizedPnl - actualChange) < 1.0, `realised ${pf.realizedPnl}`);
  // a winning trade still nets its fees: gross +$100, fees $20 -> +$80
  const wBefore = user.balance;
  const win = await openPosition(env, user, { symbol: 'BTCUSD', side: 'long', margin: 10000, leverage: 20, tp: null, sl: null });
  const row = tables.positions.find(r => r.id === win.position!.id)!;
  row.entry_price = row.entry_price * 0.9995; // pretend the fill was 0.05% lower
  const wClosed = await closePosition(env, user.id, row.id);
  check('winning trade nets fees', Math.abs((wClosed.pnl ?? 0) - (user.balance - wBefore)) < 0.01, `pnl ${wClosed.pnl}, change ${(user.balance - wBefore).toFixed(2)}`);
}

// --- liquidation matches the displayed liquidation price ---
{
  const def = getDef('BTCUSD')!;
  const entry = roundPrice(def, priceAt(def));
  const liq = liquidationFor(entry, 'long', 10);
  const pos: any = { side: 'long', qty: (1000 * 10) / entry, entry_price: entry, margin: 1000, leverage: 10 };
  check('pnl at displayed liq price is -90% of margin', Math.abs(pnlFor(pos, liq) - (-900)) < 1, `pnl ${pnlFor(pos, liq).toFixed(2)}`);
  // boundary: -950 loss is past the displayed liq price (-900) but above the old -995 threshold
  const now = priceAt(def);
  tables.positions.push({
    id: 'p_boundary', user_id: 'u_test', symbol: 'BTCUSD', side: 'long',
    qty: 10000 / (now / 0.905), entry_price: now / 0.905, leverage: 10,
    margin: 1000, notional: 10000, fee: 0.5, tp: null, sl: null, status: 'open',
    close_price: null, realized_pnl: 0, source: 'manual', trader_id: null,
    trader_name: null, close_after: null, opened_at: Date.now(), closed_at: null,
  });
  await syncPositions(env, 'u_test');
  const after = tables.positions.find(r => r.id === 'p_boundary');
  check('position past displayed liq price is liquidated', after?.status === 'closed', `status ${after?.status}`);
}

// --- Max margin button: the offered margin plus its fee fits free cash ---
{
  const margin = Math.max(10, affordableMargin(100000, 2, BASE_FEE_RATE));
  check('max margin + fee fits free cash', margin + margin * 2 * BASE_FEE_RATE <= 100000, `margin ${margin}`);
  check('max margin is close to free cash', margin > 99000, `margin ${margin}`);
  check('affordableMargin guards bad input', affordableMargin(NaN, 2, BASE_FEE_RATE) === 0 && affordableMargin(-5, 2, BASE_FEE_RATE) === 0);
}

// --- RSI: a flat market is neutral, not maximally overbought ---
{
  check('rsi(flat) is 50', rsi(Array(20).fill(100)) === 50, `got ${rsi(Array(20).fill(100))}`);
  check('rsi(rising) is 100', rsi(Array.from({ length: 20 }, (_, i) => 100 + i)) === 100);
  check('rsi(falling) is 0', rsi(Array.from({ length: 20 }, (_, i) => 200 - i)) === 0);
}

// --- Sparkline gradient id is unique per instance (useId), not data-derived ---
{
  const src = readFileSync(new URL('../src/components/Sparkline.tsx', import.meta.url), 'utf8');
  check('Sparkline uses useId for the gradient', src.includes('useId()'));
  check('no data-derived gradient id remains', !src.includes('sp-${'));
}

// --- quotes endpoint caps explicit symbol lists ---
{
  const { default: app } = await import('../worker/index.ts');
  const all = listSymbols().map((d) => d.symbol);
  const res = await app.request(`/api/market/quotes?symbols=${[...all, ...all].join(',')}`, {}, env);
  const body = await res.json() as { quotes: unknown[] };
  check('quotes endpoint caps at 400 symbols', body.quotes.length === 400, `got ${body.quotes.length}`);
  const res2 = await app.request('/api/market/quotes?symbols=BTCUSD,ETHUSD', {}, env);
  const body2 = await res2.json() as { quotes: unknown[] };
  check('quotes endpoint still serves small lists fully', body2.quotes.length === 2, `got ${body2.quotes.length}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
