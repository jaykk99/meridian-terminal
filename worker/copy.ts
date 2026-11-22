/** Copy-trading: trader roster, deterministic track records and mirrored fills. */
import type { Env, UserRow } from './db';
import { newId } from './db';
import {
  ASSET_CLASSES,
  getDef,
  priceAt,
  roundPrice,
  type AssetClass,
  type MarketDef,
} from './market';
import { closePosition, openPosition, type PositionRow } from './trading';

const MIN = 60_000;
const DAY = 86_400_000;

export type Risk = 'Low' | 'Moderate' | 'High' | 'Aggressive';

export interface TraderDef {
  id: string;
  name: string;
  handle: string;
  strategy: string;
  risk: Risk;
  cadence: number; // minutes between entries
  hold: number; // typical minutes held
  leverage: number;
  universe: AssetClass[];
  baseRoi: number;
  winRate: number;
  followers: number;
  aum: number;
  hue: number;
  bio: string;
}

export const TRADERS: TraderDef[] = [
  {
    id: 'kaia-vance',
    name: 'Kaia Vance',
    handle: 'kvance',
    strategy: 'Momentum scalper',
    risk: 'High',
    cadence: 35,
    hold: 95,
    leverage: 8,
    universe: ['Crypto'],
    baseRoi: 48.2,
    winRate: 64,
    followers: 12840,
    aum: 2_460_000,
    hue: 78,
    bio: 'Rides crypto breakouts with tight invalidation. Scalps momentum on BTC, ETH and high-beta alts.',
  },
  {
    id: 'mei-lin',
    name: 'Mei Lin',
    handle: 'mlin',
    strategy: 'Volatility harvest',
    risk: 'Aggressive',
    cadence: 45,
    hold: 130,
    leverage: 12,
    universe: ['Crypto'],
    baseRoi: 71.4,
    winRate: 55,
    followers: 18420,
    aum: 3_180_000,
    hue: 168,
    bio: 'High-octane short-horizon crypto book. Expect deep drawdowns between explosive runs.',
  },
  {
    id: 'dorian-cole',
    name: 'Dorian Cole',
    handle: 'dcole',
    strategy: 'Macro swing',
    risk: 'Moderate',
    cadence: 240,
    hold: 1_200,
    leverage: 4,
    universe: ['Forex', 'Indices'],
    baseRoi: 22.6,
    winRate: 58,
    followers: 9420,
    aum: 4_020_000,
    hue: 212,
    bio: 'Trades rate differentials and index trend continuation around macro data.',
  },
  {
    id: 'ines-okafor',
    name: 'Inés Okafor',
    handle: 'iokafor',
    strategy: 'Tech momentum',
    risk: 'High',
    cadence: 90,
    hold: 420,
    leverage: 5,
    universe: ['Equities'],
    baseRoi: 36.9,
    winRate: 61,
    followers: 7310,
    aum: 1_840_000,
    hue: 286,
    bio: 'Concentrated US software and semiconductor momentum with a 5x cap.',
  },
  {
    id: 'rafael-duarte',
    name: 'Rafael Duarte',
    handle: 'rduarte',
    strategy: 'Mean reversion',
    risk: 'Low',
    cadence: 60,
    hold: 180,
    leverage: 2,
    universe: ['ETFs', 'Indices'],
    baseRoi: 14.2,
    winRate: 68,
    followers: 11260,
    aum: 5_280_000,
    hue: 42,
    bio: 'Fades index overextensions with low leverage. Small wins, high hit rate, shallow drawdowns.',
  },
  {
    id: 'amara-diallo',
    name: 'Amara Diallo',
    handle: 'adiallo',
    strategy: 'AI thematic',
    risk: 'High',
    cadence: 120,
    hold: 600,
    leverage: 4,
    universe: ['Equities', 'ETFs'],
    baseRoi: 44.1,
    winRate: 62,
    followers: 8960,
    aum: 2_120_000,
    hue: 330,
    bio: 'Owns the compute build-out: semis, power and the data-centre supply chain.',
  },
  {
    id: 'jonas-berg',
    name: 'Jonas Berg',
    handle: 'jberg',
    strategy: 'Energy cycle',
    risk: 'Moderate',
    cadence: 300,
    hold: 1_440,
    leverage: 3,
    universe: ['Commodities'],
    baseRoi: -6.2,
    winRate: 47,
    followers: 3840,
    aum: 620_000,
    hue: 20,
    bio: 'Discretionary crude and gas swing book. Currently working through a drawdown.',
  },
  {
    id: 'theo-lindqvist',
    name: 'Theo Lindqvist',
    handle: 'tlindq',
    strategy: 'FX carry',
    risk: 'Low',
    cadence: 480,
    hold: 2_880,
    leverage: 6,
    universe: ['Forex'],
    baseRoi: 11.6,
    winRate: 66,
    followers: 6240,
    aum: 6_140_000,
    hue: 196,
    bio: 'Systematic carry and rate-differential positioning across G10 and EM pairs.',
  },
  {
    id: 'priya-raman',
    name: 'Priya Raman',
    handle: 'praman',
    strategy: 'Breakout desk',
    risk: 'Moderate',
    cadence: 75,
    hold: 240,
    leverage: 6,
    universe: ['Crypto', 'Equities'],
    baseRoi: 29.3,
    winRate: 59,
    followers: 10480,
    aum: 1_960_000,
    hue: 250,
    bio: 'Multi-asset breakout system: crypto at night, US cash equities into the close.',
  },
  {
    id: 'marco-bellini',
    name: 'Marco Bellini',
    handle: 'mbellini',
    strategy: 'Index trend',
    risk: 'Moderate',
    cadence: 180,
    hold: 900,
    leverage: 5,
    universe: ['Indices'],
    baseRoi: 4.5,
    winRate: 54,
    followers: 5120,
    aum: 2_740_000,
    hue: 8,
    bio: 'Runs trend filters on US and European index futures. Choppy tape has stalled the model.',
  },
  {
    id: 'sana-farouk',
    name: 'Sana Farouk',
    handle: 'sfarouk',
    strategy: 'Metals & macro',
    risk: 'Low',
    cadence: 360,
    hold: 1_800,
    leverage: 3,
    universe: ['Commodities'],
    baseRoi: 12.8,
    winRate: 64,
    followers: 4780,
    aum: 1_420_000,
    hue: 48,
    bio: 'Long-bias precious metals with macro hedges. Gold and silver focus.',
  },
  {
    id: 'dev-patel',
    name: 'Dev Patel',
    handle: 'dpatel',
    strategy: 'High-beta growth',
    risk: 'Aggressive',
    cadence: 60,
    hold: 300,
    leverage: 3,
    universe: ['Equities'],
    baseRoi: 58.6,
    winRate: 54,
    followers: 15340,
    aum: 1_780_000,
    hue: 142,
    bio: 'Hunts single-name asymmetry in high-beta growth. Violent month to month.',
  },
  {
    id: 'nina-sorensen',
    name: 'Nina Sørensen',
    handle: 'nsorensen',
    strategy: 'Grid & range',
    risk: 'Moderate',
    cadence: 40,
    hold: 150,
    leverage: 10,
    universe: ['Crypto'],
    baseRoi: 26.7,
    winRate: 63,
    followers: 9160,
    aum: 1_260_000,
    hue: 320,
    bio: 'Range-grid crypto book. Many small positions, frequent rotation.',
  },
  {
    id: 'omar-haddad',
    name: 'Omar Haddad',
    handle: 'ohaddad',
    strategy: 'Carry + trend',
    risk: 'Low',
    cadence: 420,
    hold: 2_160,
    leverage: 8,
    universe: ['Forex'],
    baseRoi: 9.4,
    winRate: 65,
    followers: 3980,
    aum: 3_620_000,
    hue: 182,
    bio: 'Slow-moving FX allocation blending carry and trend filters.',
  },
  {
    id: 'lucas-meyer',
    name: 'Lucas Meyer',
    handle: 'lmeyer',
    strategy: 'Sector rotation',
    risk: 'Moderate',
    cadence: 200,
    hold: 1_000,
    leverage: 3,
    universe: ['ETFs'],
    baseRoi: 17.2,
    winRate: 61,
    followers: 5820,
    aum: 2_280_000,
    hue: 100,
    bio: 'Rotates across sector ETFs on relative strength. Low turnover, no leverage spikes.',
  },
  {
    id: 'yuki-tanaka',
    name: 'Yuki Tanaka',
    handle: 'ytanaka',
    strategy: 'Semis cycle',
    risk: 'High',
    cadence: 110,
    hold: 540,
    leverage: 4,
    universe: ['Equities'],
    baseRoi: 39.8,
    winRate: 60,
    followers: 8640,
    aum: 1_640_000,
    hue: 264,
    bio: 'Semiconductor cycle specialist. Trades the memory and foundry supply chain.',
  },
];

const BY_ID = new Map(TRADERS.map((t) => [t.id, t]));

export function getTrader(id: string): TraderDef | undefined {
  return BY_ID.get(id);
}

function frac(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return h;
}

export function traderStats(t: TraderDef, now = Date.now()) {
  const seed = seedOf(t.id);
  const d = now / DAY;
  const roi30d =
    t.baseRoi * (1 + 0.16 * Math.sin(d / 3.1 + seed) + 0.06 * Math.sin(d / 1.27 + seed * 0.7));
  const winRate = Math.min(
    76,
    Math.max(38, t.winRate + 1.6 * Math.sin(d / 5.3 + seed * 1.9) + 0.6 * Math.sin(d / 1.9)),
  );
  const traded30d = Math.round((30 * 24 * 60) / t.cadence);
  const followers = Math.round(
    t.followers + (d - 19700) * (6 + frac(seed) * 14) + Math.sin(d / 2 + seed) * 90,
  );
  const aum = t.aum * (1 + 0.14 * Math.sin(d / 4.4 + seed * 0.3));
  const avgHoldHours = t.hold / 60;
  const riskScore =
    t.risk === 'Aggressive' ? 88 : t.risk === 'High' ? 72 : t.risk === 'Moderate' ? 48 : 26;
  return {
    roi30d: Math.round(roi30d * 10) / 10,
    winRate: Math.round(winRate * 10) / 10,
    followers: Math.max(120, followers),
    aum: Math.round(aum),
    traded30d,
    avgHoldHours: Math.round(avgHoldHours * 10) / 10,
    riskScore,
  };
}

export interface TraderEvent {
  k: number;
  traderId: string;
  symbol: string;
  side: 'long' | 'short';
  at: number;
  holdMs: number;
}

function universeSymbols(t: TraderDef) {
  const all = ASSET_CLASSES.filter((c) => t.universe.includes(c));
  return all.length ? all : [...ASSET_CLASSES];
}

export function traderEventsBetween(t: TraderDef, from: number, to: number): TraderEvent[] {
  const step = t.cadence * MIN;
  const seed = seedOf(t.id);
  const classes = universeSymbols(t);
  const symbols = Array.from(
    new Set(
      classes.flatMap((cls) =>
        // pull a stable sample of symbols per class from the market universe
        ALL_SYMBOLS_BY_CLASS(cls),
      ),
    ),
  );
  const out: TraderEvent[] = [];
  const kStart = Math.floor(Math.max(from, to - 36 * 3_600_000) / step) + 1;
  const kEnd = Math.floor(to / step);
  for (let k = kStart; k <= kEnd; k++) {
    const at = k * step;
    if (at <= from || at > to) continue;
    const r1 = frac(seed + k * 1.371);
    const r2 = frac(seed + k * 2.719);
    const r3 = frac(seed + k * 3.913);
    const symbol = symbols[Math.floor(r1 * symbols.length) % symbols.length];
    const side: 'long' | 'short' = r2 > 0.34 ? 'long' : 'short';
    const holdMs = t.hold * MIN * (0.7 + r3 * 0.7);
    out.push({ k, traderId: t.id, symbol, side, at, holdMs });
    if (out.length > 24) out.shift();
  }
  return out;
}

// Late-bound to avoid a circular import at module init.
let SYMBOL_INDEX: ((cls: AssetClass) => string[]) | null = null;
export function bindSymbolIndex(fn: (cls: AssetClass) => string[]) {
  SYMBOL_INDEX = fn;
}
function ALL_SYMBOLS_BY_CLASS(cls: AssetClass): string[] {
  return SYMBOL_INDEX ? SYMBOL_INDEX(cls) : [];
}

/** The trader's currently-open modelled positions, derived from their schedule. */
export function openTraderPositions(t: TraderDef, now = Date.now()) {
  const events = traderEventsBetween(t, now - 12 * 3_600_000, now);
  return events
    .filter((e) => now < e.at + e.holdMs)
    .slice(-4)
    .reverse()
    .map((e) => {
      const def = getDef(e.symbol);
      if (!def) return null;
      const entry = priceAt(def, e.at);
      const current = priceAt(def, now);
      const diff = e.side === 'long' ? current - entry : entry - current;
      return {
        symbol: e.symbol,
        name: def.name,
        assetClass: def.assetClass,
        side: e.side,
        entryPrice: roundPrice(def, entry),
        markPrice: roundPrice(def, current),
        returnPct: (diff / entry) * 100 * t.leverage,
        openedAt: e.at,
        closesAt: e.at + e.holdMs,
        leverage: t.leverage,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

export function traderPublic(t: TraderDef, now = Date.now()) {
  return {
    id: t.id,
    name: t.name,
    handle: t.handle,
    strategy: t.strategy,
    risk: t.risk,
    universe: t.universe,
    leverage: t.leverage,
    hue: t.hue,
    bio: t.bio,
    ...traderStats(t, now),
    openPositions: openTraderPositions(t, now),
  };
}

export function leaderboard(now = Date.now()) {
  return TRADERS.map((t) => traderPublic(t, now)).sort((a, b) => b.roi30d - a.roi30d);
}

/** Open a mirrored position for a follower. */
export async function mirrorPosition(
  env: Env,
  user: UserRow,
  trader: TraderDef,
  event: TraderEvent,
  allocation: number,
): Promise<'filled' | 'skipped' | 'insufficient'> {
  const def = getDef(event.symbol);
  if (!def) return 'skipped';
  const open = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM positions WHERE user_id = ? AND status = 'open' AND source = 'copy' AND trader_id = ?",
  )
    .bind(user.id, trader.id)
    .first<{ n: number }>();
  if ((open?.n ?? 0) >= 4) return 'skipped';

  const margin = Math.min(allocation * 0.25, 25_000);
  if (margin < 10) return 'skipped';
  const result = await openPosition(
    env,
    user,
    {
      symbol: event.symbol,
      side: event.side,
      margin,
      leverage: trader.leverage,
      tp: null,
      sl: null,
    },
    {
      source: 'copy',
      traderId: trader.id,
      traderName: trader.name,
      closeAfter: event.at + event.holdMs,
      fee: 0,
    },
  );
  if (result.error) return result.error.includes('cash') ? 'insufficient' : 'skipped';
  void def;
  return 'filled';
}

export async function syncCopies(env: Env, user: UserRow): Promise<number> {
  const active = await env.DB.prepare(
    "SELECT * FROM copies WHERE user_id = ? AND status = 'active'",
  )
    .bind(user.id)
    .all<{ id: string; trader_id: string; allocation: number; last_sync: number }>();

  let fills = 0;
  const now = Date.now();
  for (const copy of active.results) {
    const trader = getTrader(copy.trader_id);
    if (!trader) continue;
    const events = traderEventsBetween(trader, copy.last_sync, now);
    for (const event of events) {
      const res = await mirrorPosition(env, user, trader, event, copy.allocation);
      if (res === 'filled') fills++;
    }
    await env.DB.prepare('UPDATE copies SET last_sync = ? WHERE id = ?').bind(now, copy.id).run();
  }
  return fills;
}

export interface CopyRow {
  id: string;
  user_id: string;
  trader_id: string;
  allocation: number;
  status: string;
  last_sync: number;
  created_at: number;
}

export async function copySubscriptions(env: Env, userId: string) {
  const res = await env.DB.prepare(
    "SELECT * FROM copies WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC",
  )
    .bind(userId)
    .all<CopyRow>();

  const mirrored = await env.DB.prepare(
    "SELECT * FROM positions WHERE user_id = ? AND source = 'copy' ORDER BY opened_at DESC LIMIT 40",
  )
    .bind(userId)
    .all<PositionRow>();

  const byTrader = new Map<string, { open: number; closed: number; pnl: number }>();
  for (const p of mirrored.results) {
    const key = p.trader_id ?? 'unknown';
    const entry = byTrader.get(key) ?? { open: 0, closed: 0, pnl: 0 };
    if (p.status === 'open') entry.open++;
    else {
      entry.closed++;
      entry.pnl += p.realized_pnl;
    }
    byTrader.set(key, entry);
  }

  return res.results.map((row) => {
    const trader = getTrader(row.trader_id);
    const stats = trader ? traderPublic(trader) : null;
    const counts = byTrader.get(row.trader_id) ?? { open: 0, closed: 0, pnl: 0 };
    return {
      id: row.id,
      allocation: row.allocation,
      startedAt: row.created_at,
      lastSync: row.last_sync,
      trader: stats,
      mirroredOpen: counts.open,
      mirroredClosed: counts.closed,
      mirroredPnl: Math.round(counts.pnl * 100) / 100,
    };
  });
}

export async function startCopy(
  env: Env,
  user: UserRow,
  traderId: string,
  allocation: number,
): Promise<{ error?: string; id?: string }> {
  const trader = getTrader(traderId);
  if (!trader) return { error: 'Unknown trader.' };
  const existing = await env.DB.prepare(
    "SELECT id FROM copies WHERE user_id = ? AND trader_id = ? AND status = 'active'",
  )
    .bind(user.id, traderId)
    .first();
  if (existing) return { error: 'You already copy this trader.' };
  if (!Number.isFinite(allocation) || allocation < 100) {
    return { error: 'Minimum allocation is $100.' };
  }
  const id = newId('c');
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO copies (id, user_id, trader_id, allocation, status, last_sync, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?)",
  )
    .bind(id, user.id, traderId, Math.round(allocation * 100) / 100, now, now)
    .run();

  // Backfill any position the trader currently holds so the copy starts in sync.
  const traderPositions = openTraderPositions(trader, now);
  for (const p of traderPositions.slice(0, 2)) {
    await openPosition(
      env,
      user,
      {
        symbol: p.symbol,
        side: p.side,
        margin: Math.min(allocation * 0.2, 25_000),
        leverage: trader.leverage,
        tp: null,
        sl: null,
      },
      {
        source: 'copy',
        traderId: trader.id,
        traderName: trader.name,
        closeAfter: p.closesAt,
        fee: 0,
      },
    );
  }
  return { id };
}

export async function stopCopy(env: Env, userId: string, copyId: string) {
  const copy = await env.DB.prepare("SELECT * FROM copies WHERE id = ? AND user_id = ?")
    .bind(copyId, userId)
    .first<CopyRow>();
  if (!copy) return { error: 'Copy not found.' };
  const open = await env.DB.prepare(
    "SELECT id FROM positions WHERE user_id = ? AND status = 'open' AND source = 'copy' AND trader_id = ?",
  )
    .bind(userId, copy.trader_id)
    .all<{ id: string }>();
  for (const p of open.results) {
    await closePosition(env, userId, p.id, 'copy-stop');
  }
  await env.DB.prepare("UPDATE copies SET status = 'stopped' WHERE id = ?").bind(copyId).run();
  return { ok: true };
}
