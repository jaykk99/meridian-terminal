/** Paper-trading engine: orders, positions, PnL and portfolio maths. */
import { ensureSchema, newId, findUser, type Env, type UserRow } from './db';
import { CLASS_LEVERAGE, getDef, priceAt, roundPrice } from './market';
import { BASE_FEE_RATE, coolBalance, feeRateFor } from './sumcool';

export const FEE_RATE = BASE_FEE_RATE;
const MIN_MARGIN = 10;
const MAX_POSITIONS = 12;

export type PositionRow = {
  id: string;
  user_id: string;
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  entry_price: number;
  leverage: number;
  margin: number;
  notional: number;
  /** Fee paid when the position opened (0 for copy fills). Net PnL subtracts it. */
  fee: number;
  tp: number | null;
  sl: number | null;
  status: 'open' | 'closed';
  close_price: number | null;
  realized_pnl: number;
  source: 'manual' | 'copy';
  trader_id: string | null;
  trader_name: string | null;
  close_after: number | null;
  opened_at: number;
  closed_at: number | null;
};

export interface OpenRequest {
  symbol: string;
  side: 'long' | 'short';
  margin: number;
  leverage: number;
  tp?: number | null;
  sl?: number | null;
}

export interface OpenOptions {
  source?: 'manual' | 'copy';
  traderId?: string;
  traderName?: string;
  closeAfter?: number;
  entryPrice?: number;
  fee?: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pnlFor(pos: PositionRow, price: number): number {
  const diff = pos.side === 'long' ? price - pos.entry_price : pos.entry_price - price;
  return diff * pos.qty;
}

export function liquidationFor(entry: number, side: 'long' | 'short', leverage: number): number {
  const factor = 0.9 / leverage;
  return side === 'long' ? entry * (1 - factor) : entry * (1 + factor);
}

export async function openPosition(
  env: Env,
  user: UserRow,
  input: OpenRequest,
  opts: OpenOptions = {},
): Promise<{ position?: PositionRow; error?: string }> {
  const def = getDef(input.symbol);
  if (!def) return { error: 'Unknown market.' };
  const side = input.side === 'short' ? 'short' : 'long';
  const margin = Number(input.margin);
  const leverage = Math.min(
    Math.max(1, Number(input.leverage) || 1),
    CLASS_LEVERAGE[def.assetClass],
  );
  if (!Number.isFinite(margin) || margin < MIN_MARGIN) {
    return { error: `Minimum order is $${MIN_MARGIN}.` };
  }
  const price =
    opts.entryPrice && opts.entryPrice > 0 ? opts.entryPrice : roundPrice(def, priceAt(def));
  if (!Number.isFinite(price) || price <= 0) return { error: 'No price available.' };

  const notional = margin * leverage;
  if (notional > 2_000_000) return { error: 'Order too large for this account.' };
  // COOL holders pay less, and the top tier pays nothing at all.
  const rate = opts.fee == null ? await feeRateFor(env, user.id) : 0;
  const fee = opts.fee ?? notional * rate;

  const openCount = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM positions WHERE user_id = ? AND status = 'open'",
  )
    .bind(user.id)
    .first<{ n: number }>();
  if ((openCount?.n ?? 0) >= MAX_POSITIONS) {
    return { error: `Close a position first — ${MAX_POSITIONS} open is the limit.` };
  }

  const fresh = await findUser(env, user.id);
  if (!fresh) return { error: 'Account not found.' };
  if (fresh.balance < margin + fee) {
    return {
      error: `Need $${round2(margin + fee).toLocaleString()} available cash. You have $${round2(
        fresh.balance,
      ).toLocaleString()}.`,
    };
  }

  // Normalise protective levels against the fill.
  let tp = input.tp != null && Number.isFinite(Number(input.tp)) ? Number(input.tp) : null;
  let sl = input.sl != null && Number.isFinite(Number(input.sl)) ? Number(input.sl) : null;
  if (tp != null) {
    const valid = side === 'long' ? tp > price : tp < price;
    if (!valid) return { error: 'Take profit is on the wrong side of the price.' };
  }
  if (sl != null) {
    const valid = side === 'long' ? sl < price : sl > price;
    if (!valid) return { error: 'Stop loss is on the wrong side of the price.' };
  }
  if (tp != null && tp <= 0) tp = null;
  if (sl != null && sl <= 0) sl = null;

  const position: PositionRow = {
    id: newId('p'),
    user_id: user.id,
    symbol: def.symbol,
    side,
    qty: notional / price,
    entry_price: price,
    leverage,
    margin,
    notional,
    fee,
    tp,
    sl,
    status: 'open',
    close_price: null,
    realized_pnl: 0,
    source: opts.source ?? 'manual',
    trader_id: opts.traderId ?? null,
    trader_name: opts.traderName ?? null,
    close_after: opts.closeAfter ?? null,
    opened_at: Date.now(),
    closed_at: null,
  };

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').bind(
      margin + fee,
      user.id,
    ),
    env.DB.prepare(
      `INSERT INTO positions (id, user_id, symbol, side, qty, entry_price, leverage, margin, notional, fee,
        tp, sl, status, close_price, realized_pnl, source, trader_id, trader_name, close_after, opened_at, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, 0, ?, ?, ?, ?, ?, NULL)`,
    ).bind(
      position.id,
      position.user_id,
      position.symbol,
      position.side,
      position.qty,
      position.entry_price,
      position.leverage,
      position.margin,
      position.notional,
      position.fee,
      position.tp,
      position.sl,
      position.source,
      position.trader_id,
      position.trader_name,
      position.close_after,
      position.opened_at,
    ),
  ]);

  return { position };
}

export async function closePosition(
  env: Env,
  userId: string,
  positionId: string,
  reason = 'manual',
): Promise<{ pnl?: number; error?: string }> {
  const pos = await env.DB.prepare('SELECT * FROM positions WHERE id = ? AND user_id = ?')
    .bind(positionId, userId)
    .first<PositionRow>();
  if (!pos) return { error: 'Position not found.' };
  if (pos.status !== 'open') return { error: 'Position already closed.' };

  const def = getDef(pos.symbol);
  if (!def) return { error: 'Unknown market.' };
  let exit = roundPrice(def, priceAt(def));
  if (reason === 'tp' && pos.tp != null) exit = pos.tp;
  if (reason === 'sl' && pos.sl != null) exit = pos.sl;

  // Net realised PnL is the actual balance change from the trade: the margin
  // comes back, the open fee was already paid at entry, and the close fee
  // comes out of the credit. Recording the gross PnL overstated results by
  // both fees and left the equity curve jumping down to equity at its last
  // point. If the credit hits zero, the close fee was never actually paid,
  // so it is not part of the loss.
  const grossPnl = pnlFor(pos, exit);
  const openFee = pos.fee ?? 0;
  const closeFee = pos.notional * (await feeRateFor(env, userId));
  const credited = round2(Math.max(0, pos.margin + grossPnl - closeFee));
  const netPnl = round2(credited - pos.margin - openFee);

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').bind(
      credited,
      userId,
    ),
    env.DB.prepare(
      `UPDATE positions SET status = 'closed', close_price = ?, realized_pnl = ?, closed_at = ?
       WHERE id = ? AND user_id = ?`,
    ).bind(round2(exit), netPnl, Date.now(), pos.id, userId),
  ]);

  return { pnl: netPnl };
}

/**
 * Settle any position that hit its stop, target, liquidation or copy-trade
 * expiry. Called before portfolio reads and after order placement.
 */
export async function syncPositions(env: Env, userId: string): Promise<void> {
  const open = await env.DB.prepare(
    "SELECT * FROM positions WHERE user_id = ? AND status = 'open'",
  )
    .bind(userId)
    .all<PositionRow>();

  for (const pos of open.results) {
    const def = getDef(pos.symbol);
    if (!def) continue;
    const price = priceAt(def);
    const pnl = pnlFor(pos, price);

    if (pos.close_after && Date.now() >= pos.close_after) {
      await closePosition(env, userId, pos.id, 'copy-exit');
      continue;
    }
    if (pos.tp != null && (pos.side === 'long' ? price >= pos.tp : price <= pos.tp)) {
      await closePosition(env, userId, pos.id, 'tp');
      continue;
    }
    if (pos.sl != null && (pos.side === 'long' ? price <= pos.sl : price >= pos.sl)) {
      await closePosition(env, userId, pos.id, 'sl');
      continue;
    }
    // Liquidate at the same 90%-of-margin loss the UI shows as the
    // liquidation price (liquidationFor uses a 0.9 / leverage move).
    if (pnl <= -pos.margin * 0.9) {
      await closePosition(env, userId, pos.id, 'liquidation');
    }
  }
}

export interface MarkedPosition extends PositionRow {
  name: string;
  assetClass: string;
  markPrice: number;
  unrealized: number;
  roe: number;
  liquidationPrice: number;
}

export function markPosition(pos: PositionRow, now = Date.now()): MarkedPosition {
  const def = getDef(pos.symbol);
  const price = def ? priceAt(def, now) : pos.entry_price;
  const unrealized = pnlFor(pos, price);
  return {
    ...pos,
    name: def?.name ?? pos.symbol,
    assetClass: def?.assetClass ?? 'Crypto',
    markPrice: def ? roundPrice(def, price) : pos.entry_price,
    unrealized: round2(unrealized),
    roe: (unrealized / pos.margin) * 100,
    liquidationPrice: def
      ? roundPrice(def, liquidationFor(pos.entry_price, pos.side, pos.leverage))
      : 0,
  };
}

export async function buildPortfolio(env: Env, user: UserRow) {
  await ensureSchema(env);
  await syncPositions(env, user.id);

  const [openRes, closedRes, fresh, feeRate, cool] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC",
    )
      .bind(user.id)
      .all<PositionRow>(),
    env.DB.prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'closed' ORDER BY closed_at DESC LIMIT 60",
    )
      .bind(user.id)
      .all<PositionRow>(),
    findUser(env, user.id),
    feeRateFor(env, user.id),
    coolBalance(env, user.id),
  ]);

  const account = fresh ?? user;
  const open = openRes.results.map((p) => markPosition(p));
  const unrealized = open.reduce((sum, p) => sum + p.unrealized, 0);
  const usedMargin = open.reduce((sum, p) => sum + p.margin, 0);
  const exposure = open.reduce((sum, p) => sum + p.notional, 0);
  const equity = account.balance + usedMargin + unrealized;

  const closed = closedRes.results.map((p) => {
    const def = getDef(p.symbol);
    return { ...p, name: def?.name ?? p.symbol, assetClass: def?.assetClass ?? 'Crypto' };
  });

  const chronological = [...closed].reverse();
  const curve: { t: number; v: number }[] = [
    { t: account.created_at, v: round2(account.starting_balance) },
  ];
  let running = account.starting_balance;
  for (const p of chronological) {
    running += p.realized_pnl;
    curve.push({ t: p.closed_at ?? Date.now(), v: round2(running) });
  }
  curve.push({ t: Date.now(), v: round2(equity) });

  let peak = curve[0]?.v ?? equity;
  let maxDrawdown = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.v);
    maxDrawdown = Math.max(maxDrawdown, (peak - point.v) / peak);
  }

  const realized = closed.reduce((sum, p) => sum + p.realized_pnl, 0);
  const wins = closed.filter((p) => p.realized_pnl > 0).length;

  return {
    account: {
      id: account.id,
      login: account.login,
      name: account.name,
      avatarUrl: account.avatar_url,
      isGuest: Boolean(account.is_guest),
      balance: round2(account.balance),
      startingBalance: account.starting_balance,
      createdAt: account.created_at,
      walletAddress: account.wallet_address ?? null,
      provider: account.github_id
        ? ('github' as const)
        : account.wallet_address
          ? ('wallet' as const)
          : ('guest' as const),
    },
    equity: round2(equity),
    freeCash: round2(account.balance),
    unrealizedPnl: round2(unrealized),
    realizedPnl: round2(realized),
    usedMargin: round2(usedMargin),
    exposure: round2(exposure),
    buyingPower: round2(account.balance * 2),
    feeRate,
    coolBalance: cool,
    maxDrawdown: maxDrawdown * 100,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    totalTrades: closed.length,
    openPositions: open,
    history: closed,
    curve,
  };
}

export { round2 };
