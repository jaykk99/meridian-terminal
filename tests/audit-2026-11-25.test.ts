/**
 * Repro/verification for meridian-terminal audit findings.
 * Runs the real worker modules against a tiny in-memory fake D1.
 * Usage: bun run repro.test.ts  (exit 0 = all checks pass)
 */
import { getDef, priceAt, roundPrice } from '../worker/market';
import {
  buildPortfolio,
  closePosition,
  liquidationFor,
  openPosition,
  pnlFor,
  syncPositions,
  type PositionRow,
} from '../worker/trading';
import { BASE_FEE_RATE } from '../worker/sumcool';
import { ensureSchema, type Env, type UserRow } from '../worker/db';

// ---------------------------------------------------------------- fake D1
type Row = Record<string, unknown>;
class FakeStmt {
  constructor(
    private db: FakeD1,
    private sql: string,
    private args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new FakeStmt(this.db, this.sql, args);
  }
  private table(): Row[] {
    const m = this.sql.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)/i);
    const name = (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').toLowerCase();
    if (!this.db.tables[name]) this.db.tables[name] = [];
    return this.db.tables[name];
  }
  async first<T>(): Promise<T | null> {
    const rows = await this.all<T>();
    return rows.results[0] ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    const sql = this.sql;
    const rows = this.table();
    let out: Row[] = [...rows];
    // WHERE user_id = ? AND status = 'open' / 'closed'
    const whereUser = sql.match(/WHERE user_id = \?/);
    const status = sql.match(/status = '(open|closed)'/);
    if (whereUser) out = out.filter((r) => r.user_id === this.args[0]);
    if (status) out = out.filter((r) => r.status === status[1]);
    const whereId = sql.match(/WHERE id = \? AND user_id = \?/);
    if (whereId) out = out.filter((r) => r.id === this.args[0] && r.user_id === this.args[1]);
    const countOnly = /COUNT\(\*\) AS n/i.test(sql);
    if (countOnly) return { results: [{ n: out.length } as unknown as T] };
    if (/ORDER BY opened_at DESC/i.test(sql)) out.sort((a, b) => (b.opened_at as number) - (a.opened_at as number));
    if (/ORDER BY closed_at DESC/i.test(sql)) out.sort((a, b) => ((b.closed_at as number) ?? 0) - ((a.closed_at as number) ?? 0));
    const limit = sql.match(/LIMIT (\d+)/i);
    if (limit) out = out.slice(0, Number(limit[1]));
    // SELECT amount FROM token_balances -> no rows by default
    return { results: out as unknown as T[] };
  }
  async run(): Promise<{ success: boolean }> {
    const sql = this.sql;
    const rows = this.table();
    if (/^INSERT INTO users/i.test(sql)) {
      rows.push({
        id: this.args[0], github_id: this.args[1], login: this.args[2], name: this.args[3],
        avatar_url: this.args[4], is_guest: this.args[5], balance: this.args[6],
        starting_balance: this.args[7], created_at: this.args[8], wallet_address: null,
      });
      return { success: true };
    }
    if (/^INSERT INTO positions/i.test(sql)) {
      const cols = ['id','user_id','symbol','side','qty','entry_price','leverage','margin','notional','tp','sl','status','close_price','realized_pnl','source','trader_id','trader_name','close_after','opened_at','closed_at'];
      const row: Row = {};
      // The INSERT binds 19 values in column order, with 'open'/NULL/0 literals for
      // status/close_price/realized_pnl/closed_at. Our fake maps by position in the
      // VALUES list: id..close_after, opened_at (18 binds) + literals.
      const binds = this.args;
      const keys = ['id','user_id','symbol','side','qty','entry_price','leverage','margin','notional','tp','sl','source','trader_id','trader_name','close_after','opened_at'];
      keys.forEach((k, i) => { row[k] = binds[i]; });
      row.status = 'open'; row.close_price = null; row.realized_pnl = 0; row.closed_at = null;
      // open_fee is bound after close_after in the fixed INSERT; detect by arity.
      if (binds.length === 18) { row.open_fee = binds[16]; row.fee_rate = binds[17]; }
      else if (binds.length === 17) row.open_fee = binds[16];
      else row.open_fee = 0;
      void cols;
      rows.push(row);
      return { success: true };
    }
    if (/^UPDATE users SET balance = balance - \?/i.test(sql)) {
      const u = rows.find((r) => r.id === this.args[1]);
      if (u) u.balance = (u.balance as number) - (this.args[0] as number);
      return { success: true };
    }
    if (/^UPDATE users SET balance = balance \+ \?/i.test(sql)) {
      const u = rows.find((r) => r.id === this.args[1]);
      if (u) u.balance = (u.balance as number) + (this.args[0] as number);
      return { success: true };
    }
    if (/^UPDATE positions SET status/i.test(sql)) {
      const p = rows.find((r) => r.id === this.args[3] && r.user_id === this.args[4]);
      if (p) {
        p.status = 'closed'; p.close_price = this.args[0]; p.realized_pnl = this.args[1]; p.closed_at = this.args[2];
      }
      return { success: true };
    }
    // DDL / ALTER / everything else: no-op success
    return { success: true };
  }
}
class FakeD1 {
  tables: Record<string, Row[]> = {};
  prepare(sql: string) {
    return new FakeStmt(this, sql);
  }
  async batch(stmts: FakeStmt[]) {
    const out = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  }
}

const db = new FakeD1();
const env = { DB: db, ASSETS: null } as unknown as Env;

function makeUser(balance = 100_000): UserRow {
  const u: UserRow = {
    id: 'u_test', github_id: null, login: 'tester', name: 'Tester', avatar_url: null,
    wallet_address: null, is_guest: 0, balance, starting_balance: balance, created_at: Date.now(),
  };
  db.tables.users = [{ ...u }];
  return u;
}

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

// ---------------------------------------------------------- 1. liquidation
{
  const def = getDef('BTCUSD')!;
  const now = priceAt(def);
  const margin = 1000;
  const leverage = 5;
  // Craft a long whose current mark is BELOW its displayed liquidation price:
  // entry E with current price P = 0.816*E. Displayed liq = E*(1-0.9/5) = 0.82*E,
  // so P < liq price and pnl = (P-E)*qty = -0.92*margin (past the 90% line,
  // short of the old 99.5% line).
  const entry = now / 0.816;
  const qty = (margin * leverage) / entry;
  const liq = liquidationFor(entry, 'long', leverage);
  check(
    'liquidation: displayed liq price loses exactly 90% of margin',
    Math.abs(pnlFor({ entry_price: entry, qty, side: 'long' } as PositionRow, liq) + margin * 0.9) < 0.01,
    `liq=${liq.toFixed(2)} entry=${entry.toFixed(2)} current=${now.toFixed(2)}`,
  );
  makeUser(100_000);
  db.tables.positions = [{
    id: 'p_liq', user_id: 'u_test', symbol: 'BTCUSD', side: 'long', qty,
    entry_price: entry, leverage, margin, notional: margin * leverage,
    tp: null, sl: null, status: 'open', close_price: null, realized_pnl: 0,
    source: 'manual', trader_id: null, trader_name: null, close_after: null,
    opened_at: Date.now(), closed_at: null, open_fee: 0,
  }];
  await syncPositions(env, 'u_test');
  const after = (await db.prepare('SELECT * FROM positions WHERE id = ? AND user_id = ?').bind('p_liq', 'u_test').first<PositionRow>())!;
  check(
    'liquidation: position past its displayed liquidation price is liquidated',
    after.status === 'closed',
    `status=${after.status} pnl=${pnlFor({ entry_price: entry, qty, side: 'long' } as PositionRow, now).toFixed(2)} (margin ${margin})`,
  );
}

// ------------------------------------------- 2. realised PnL nets all fees
{
  await ensureSchema(env);
  const user = makeUser(100_000);
  db.tables.positions = []; // isolate from the liquidation check's open position
  const startBalance = user.balance;
  const opened = await openPosition(env, user, {
    symbol: 'BTCUSD', side: 'long', margin: 1000, leverage: 5,
  });
  check('open: position created', Boolean(opened.position), opened.error ?? '');
  const pos = opened.position!;
  const openFee = 5000 * BASE_FEE_RATE; // notional 5000 * 0.005% = $0.25
  const afterOpen = (await db.prepare('SELECT * FROM users WHERE id = ?').bind('u_test').first<UserRow>())!;
  check(
    'open: balance debited margin + open fee',
    Math.abs(afterOpen.balance - (startBalance - 1000 - openFee)) < 0.01,
    `balance=${afterOpen.balance}`,
  );
  const closed = await closePosition(env, 'u_test', pos.id, 'manual');
  check('close: no error', Boolean(closed.pnl !== undefined), closed.error ?? '');
  const afterClose = (await db.prepare('SELECT * FROM users WHERE id = ?').bind('u_test').first<UserRow>())!;
  const balanceChange = afterClose.balance - startBalance;
  const stored = (await db.prepare('SELECT * FROM positions WHERE id = ? AND user_id = ?').bind(pos.id, 'u_test').first<PositionRow>())!;
  check(
    'close: stored realised_pnl equals actual balance change (fees included)',
    Math.abs(stored.realized_pnl - Math.round(balanceChange * 100) / 100) < 0.011,
    `realised_pnl=${stored.realized_pnl} balanceChange=${balanceChange.toFixed(2)}`,
  );
  check(
    'close: returned pnl equals stored realised_pnl',
    closed.pnl === stored.realized_pnl,
    `returned=${closed.pnl} stored=${stored.realized_pnl}`,
  );
  // Equity curve must reconcile: starting + sum(realised) == final equity.
  const pf = await buildPortfolio(env, afterClose);
  const running = pf.account.startingBalance + pf.history.reduce((s, p) => s + p.realized_pnl, 0);
  check(
    'portfolio: equity curve reconciles with balance (no open positions)',
    Math.abs(running - pf.equity) < 0.011,
    `curve=${running.toFixed(2)} equity=${pf.equity.toFixed(2)}`,
  );
}

// ------------------------------------------- 3. Max-margin button math
{
  const freeCash = 100_000;
  const leverage = 5;
  const feeRate = BASE_FEE_RATE; // standard tier
  const oldMax = Math.max(10, Math.floor(freeCash * 1));
  const oldRejected = oldMax + oldMax * leverage * feeRate > freeCash;
  check(
    'trade ticket: old Max margin is rejected by the fee check (repro)',
    oldRejected,
    `margin=${oldMax} fee=${(oldMax * leverage * feeRate).toFixed(2)} total=${(oldMax + oldMax * leverage * feeRate).toFixed(2)} > ${freeCash}`,
  );
  const newMax = Math.max(10, Math.floor(freeCash / (1 + feeRate * leverage)));
  const newOk = newMax + newMax * leverage * feeRate <= freeCash;
  check(
    'trade ticket: fee-aware Max margin passes the fee check',
    newOk,
    `margin=${newMax} fee=${(newMax * leverage * feeRate).toFixed(2)}`,
  );
}

// ------------------------------------------- 4. copy trades stay fee-free
// mirrorPosition/startCopy open copy trades with fee: 0, so the exit fee must
// be $0 too. Repro: open a copy trade (fee 0), close it at once; the only
// legitimate loss is a few cents of price drift, not a $0.25 close fee.
{
  await ensureSchema(env);
  const user = makeUser(100_000);
  db.tables.positions = [];
  const startBalance = user.balance;
  const opened = await openPosition(
    env,
    user,
    { symbol: 'BTCUSD', side: 'long', margin: 1000, leverage: 5 },
    { source: 'copy', traderId: 'kaia-vance', traderName: 'Kaia Vance', fee: 0 },
  );
  check('copy open: position created with zero open fee', Boolean(opened.position) && opened.position!.open_fee === 0, opened.error ?? '');
  const pos = opened.position!;
  const closed = await closePosition(env, 'u_test', pos.id, 'manual');
  const stored = (await db.prepare('SELECT * FROM positions WHERE id = ? AND user_id = ?').bind(pos.id, 'u_test').first<PositionRow>())!;
  const afterClose = (await db.prepare('SELECT * FROM users WHERE id = ?').bind('u_test').first<UserRow>())!;
  const balanceChange = afterClose.balance - startBalance;
  // notional 5000 * 0.005% = $0.25 close fee on the old code; a fee-free copy
  // trade closed at once should be within a few cents of break-even.
  check(
    'copy close: no close fee on a fee-free copy trade',
    Math.abs(stored.realized_pnl) < 0.05,
    `realised_pnl=${stored.realized_pnl} (old code charges -$${(5000 * BASE_FEE_RATE).toFixed(2)} close fee)`,
  );
  check(
    'copy close: balance change matches stored realised PnL',
    Math.abs(balanceChange - stored.realized_pnl) < 0.011,
    `balanceChange=${balanceChange.toFixed(2)} realised_pnl=${stored.realized_pnl}`,
  );
  void closed;
}

// ------------------------------------------- 5. candles limit robustness
{
  const def = getDef('BTCUSD')!;
  const { candlesFor } = await import('../worker/market');
  const bad = candlesFor(def, '1h', NaN);
  check(
    'candles: NaN limit falls back to the default instead of returning []',
    bad.length === 180,
    `got ${bad.length} candles`,
  );
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
