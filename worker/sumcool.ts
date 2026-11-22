/** Sum Cool (COOL): the platform token — free claim, fee tiers and a spot book. */
import { findUser, newId, type Env, type UserRow } from './db';
import { getDef, priceAt, quoteFor, roundPrice } from './market';

export const COOL_SYMBOL = 'COOLUSD';
export const COOL_SUPPLY = 100_000_000;
export const COOL_CIRCULATING = 42_000_000;
export const COOL_CLAIM = 500;
/** Base trading fee is 0.005%; holding COOL discounts it to zero. */
export const BASE_FEE_RATE = 0.00005;

type Tier = { min: number; label: string; discount: number; blurb: string };

const TIERS: Tier[] = [
  { min: 5000, label: 'Fee-free', discount: 1, blurb: '0% trading fees' },
  { min: 1500, label: 'Gold', discount: 0.5, blurb: '50% off fees' },
  { min: 500, label: 'Silver', discount: 0.25, blurb: '25% off fees' },
  { min: 0, label: 'Standard', discount: 0, blurb: 'Base fee' },
];

export function tierFor(balance: number): Tier {
  return TIERS.find((tier) => balance >= tier.min) ?? TIERS[TIERS.length - 1];
}

export function feeRateForBalance(balance: number): number {
  return BASE_FEE_RATE * (1 - tierFor(balance).discount);
}

export async function coolBalance(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT amount FROM token_balances WHERE user_id = ?')
    .bind(userId)
    .first<{ amount: number }>();
  return row?.amount ?? 0;
}

/** Effective fee rate for a user, after their COOL tier discount. */
export async function feeRateFor(env: Env, userId: string): Promise<number> {
  return feeRateForBalance(await coolBalance(env, userId));
}

function displayName(row: {
  name: string | null;
  login: string | null;
  wallet_address: string | null;
}): string {
  if (row.wallet_address) {
    return `${row.wallet_address.slice(0, 6)}…${row.wallet_address.slice(-4)}`;
  }
  return row.name ?? row.login ?? 'Trader';
}

export async function sumCoolStats(env: Env, user?: UserRow) {
  const def = getDef(COOL_SYMBOL)!;
  const quote = quoteFor(def, Date.now(), 0);
  const balance = user ? await coolBalance(env, user.id) : 0;

  const [holdersRow, claimedRow, claimsRes] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM token_balances WHERE amount > 0').first<{
      n: number;
    }>(),
    user
      ? env.DB.prepare('SELECT amount FROM token_claims WHERE user_id = ?')
          .bind(user.id)
          .first<{ amount: number }>()
      : Promise.resolve(null),
    env.DB.prepare(
      `SELECT l.amount, l.created_at, u.name, u.login, u.wallet_address
       FROM token_ledger l JOIN users u ON u.id = l.user_id
       WHERE l.kind = 'claim' ORDER BY l.created_at DESC LIMIT 8`,
    ).all<{
      amount: number;
      created_at: number;
      name: string | null;
      login: string | null;
      wallet_address: string | null;
    }>(),
  ]);

  const tier = tierFor(balance);
  const nextTier = [...TIERS].reverse().find((t) => t.min > balance) ?? null;
  const progress = nextTier
    ? Math.min(100, ((balance - tier.min) / (nextTier.min - tier.min)) * 100)
    : 100;

  return {
    symbol: def.symbol,
    name: def.name,
    price: quote.price,
    change24h: quote.change24h,
    high24h: quote.high24h,
    low24h: quote.low24h,
    supply: COOL_SUPPLY,
    circulating: COOL_CIRCULATING,
    marketCap: Math.round(quote.price * COOL_CIRCULATING),
    fdv: Math.round(quote.price * COOL_SUPPLY),
    holders: holdersRow?.n ?? 0,
    claimAmount: COOL_CLAIM,
    balance,
    claimed: Boolean(claimedRow),
    baseFeeRate: BASE_FEE_RATE,
    feeTier: {
      label: tier.label,
      blurb: tier.blurb,
      discountPct: tier.discount * 100,
      rate: feeRateForBalance(balance),
      nextAt: nextTier?.min ?? null,
      nextLabel: nextTier?.label ?? null,
      progress: Math.round(progress),
    },
    recentClaims: claimsRes.results.map((row) => ({
      name: displayName(row),
      amount: row.amount,
      at: row.created_at,
    })),
  };
}

export async function claimCool(env: Env, user: UserRow): Promise<{ error?: string; amount?: number }> {
  const existing = await env.DB.prepare('SELECT amount FROM token_claims WHERE user_id = ?')
    .bind(user.id)
    .first();
  if (existing) return { error: 'You already claimed your free Sum Cool.' };

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO token_claims (user_id, amount, created_at) VALUES (?, ?, ?)').bind(
      user.id,
      COOL_CLAIM,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO token_balances (user_id, amount, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET amount = amount + excluded.amount, updated_at = excluded.updated_at`,
    ).bind(user.id, COOL_CLAIM, now),
    env.DB.prepare(
      `INSERT INTO token_ledger (id, user_id, kind, amount, price, usd, created_at)
       VALUES (?, ?, 'claim', ?, 0, 0, ?)`,
    ).bind(newId('tl'), user.id, COOL_CLAIM, now),
  ]);

  return { amount: COOL_CLAIM };
}

export async function tradeCool(
  env: Env,
  user: UserRow,
  action: 'buy' | 'sell',
  usd?: number,
  amount?: number,
): Promise<{ error?: string; tokens?: number; proceeds?: number; price?: number }> {
  const def = getDef(COOL_SYMBOL)!;
  const price = roundPrice(def, priceAt(def));
  const fresh = await findUser(env, user.id);
  if (!fresh) return { error: 'Account not found.' };
  const now = Date.now();

  if (action === 'buy') {
    const spend = Number(usd);
    if (!Number.isFinite(spend) || spend < 10) return { error: 'Minimum purchase is $10.' };
    if (spend > fresh.balance) return { error: 'Not enough free cash for that purchase.' };
    const tokens = spend / price;
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').bind(spend, user.id),
      env.DB.prepare(
        `INSERT INTO token_balances (user_id, amount, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET amount = amount + excluded.amount, updated_at = excluded.updated_at`,
      ).bind(user.id, tokens, now),
      env.DB.prepare(
        `INSERT INTO token_ledger (id, user_id, kind, amount, price, usd, created_at)
         VALUES (?, ?, 'buy', ?, ?, ?, ?)`,
      ).bind(newId('tl'), user.id, tokens, price, spend, now),
    ]);
    return { tokens, price };
  }

  const sell = Number(amount);
  if (!Number.isFinite(sell) || sell <= 0) return { error: 'Enter an amount to sell.' };
  const balance = await coolBalance(env, user.id);
  if (sell > balance) return { error: 'You do not hold that much COOL.' };
  const proceeds = sell * price;
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').bind(proceeds, user.id),
    env.DB.prepare('UPDATE token_balances SET amount = amount - ?, updated_at = ? WHERE user_id = ?').bind(
      sell,
      now,
      user.id,
    ),
    env.DB.prepare(
      `INSERT INTO token_ledger (id, user_id, kind, amount, price, usd, created_at)
       VALUES (?, ?, 'sell', ?, ?, ?, ?)`,
    ).bind(newId('tl'), user.id, sell, price, proceeds, now),
  ]);
  return { proceeds, price };
}
