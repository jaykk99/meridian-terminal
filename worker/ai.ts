/** AI desk: indicator ensemble, signals, scanner and market briefing. */
import {
  candlesFor,
  getDef,
  listSymbols,
  priceAt,
  roundPrice,
  type Candle,
  type MarketDef,
} from './market';

export interface Signal {
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  change24h: number;
  score: number;
  confidence: number;
  label: string;
  horizon: string;
  rsi: number;
  trend: 'up' | 'down' | 'flat';
  volatilityPct: number;
  support: number;
  resistance: number;
  target: number;
  invalidation: number;
  rationale: string[];
  drivers: { name: string; value: number; weight: number }[];
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let out = values[0];
  for (let i = 1; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(candles: Candle[], period = 14): number {
  const slice = candles.slice(-period - 1);
  let sum = 0;
  let n = 0;
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].c;
    const cur = slice[i];
    sum += Math.max(cur.h - cur.l, Math.abs(cur.h - prev), Math.abs(cur.l - prev));
    n++;
  }
  return n ? sum / n : 0;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function signalFor(def: MarketDef): Signal {
  const candles = candlesFor(def, '1h', 140);
  const closes = candles.map((c) => c.c);
  const price = priceAt(def);
  const fast = ema(closes.slice(-40), 9);
  const slow = ema(closes.slice(-80), 21);
  const slowLong = ema(closes, 55);
  const a = atr(candles, 14) || price * 0.004;
  const rsiValue = rsi(closes, 14);
  const roc = closes.length > 24 ? (closes[closes.length - 1] - closes[closes.length - 25]) / closes[closes.length - 25] : 0;
  const recent = candles.slice(-24);
  const high24 = Math.max(...recent.map((c) => c.h));
  const low24 = Math.min(...recent.map((c) => c.l));
  const rangePos = high24 === low24 ? 0.5 : (price - low24) / (high24 - low24);

  const trendSignal = Math.tanh(((fast - slow) / a) * 0.7);
  const structure = Math.tanh(((slow - slowLong) / a) * 0.6);
  const momentum = Math.tanh(roc / 0.02);
  const rsiSignal = rsiValue > 76 ? -0.35 : rsiValue < 24 ? 0.4 : (rsiValue - 50) / 34;
  const range = (rangePos - 0.5) * 0.9;

  const score = clamp(
    0.36 * trendSignal + 0.2 * structure + 0.24 * momentum + 0.12 * rsiSignal + 0.08 * range,
    -1,
    1,
  );
  const confidence = Math.round(
    clamp(52 + Math.abs(score) * 44 + Math.abs(trendSignal - momentum) * 4, 51, 96),
  );
  const label =
    score > 0.46
      ? 'Strong buy'
      : score > 0.16
        ? 'Buy'
        : score < -0.46
          ? 'Strong sell'
          : score < -0.16
            ? 'Sell'
            : 'Neutral';
  const dir = score >= 0 ? 1 : -1;
  const prev24 = priceAt(def, Date.now() - 86_400_000);

  const rationale: string[] = [];
  if (fast > slow) rationale.push('9-period EMA is above the 21 EMA — short-term structure is bullish.');
  else rationale.push('9-period EMA is below the 21 EMA — short-term structure is bearish.');
  if (slow > slowLong) rationale.push('The 21 EMA holds above the 55 EMA, so the higher-timeframe trend agrees.');
  else rationale.push('The 21 EMA sits below the 55 EMA; the higher-timeframe trend is still heavy.');
  if (rsiValue > 74) rationale.push(`RSI ${rsiValue.toFixed(0)} is overbought — chasing here has poor expectancy.`);
  else if (rsiValue < 26) rationale.push(`RSI ${rsiValue.toFixed(0)} is oversold — mean-reversion risk is elevated.`);
  else rationale.push(`RSI ${rsiValue.toFixed(0)} leaves room before momentum is stretched.`);
  rationale.push(
    `Price is in the ${Math.round(rangePos * 100)}th percentile of its 24h range (${low24.toFixed(
      2,
    )}–${high24.toFixed(2)}).`,
  );
  rationale.push(
    `Realised 1h volatility ${((a / price) * 100).toFixed(2)}% — size positions to this, not to conviction.`,
  );

  return {
    symbol: def.symbol,
    name: def.name,
    assetClass: def.assetClass,
    price: roundPrice(def, price),
    change24h: Math.round(((price - prev24) / prev24) * 10000) / 100,
    score: Math.round(score * 100) / 100,
    confidence,
    label,
    horizon: '24–72h',
    rsi: Math.round(rsiValue * 10) / 10,
    trend: trendSignal > 0.12 ? 'up' : trendSignal < -0.12 ? 'down' : 'flat',
    volatilityPct: Math.round((a / price) * 10000) / 100,
    support: roundPrice(def, low24),
    resistance: roundPrice(def, high24),
    target: roundPrice(def, price + dir * a * 2.4),
    invalidation: roundPrice(def, price - dir * a * 1.4),
    rationale,
    drivers: [
      { name: 'Trend', value: Math.round(trendSignal * 100) / 100, weight: 0.36 },
      { name: 'Structure', value: Math.round(structure * 100) / 100, weight: 0.2 },
      { name: 'Momentum', value: Math.round(momentum * 100) / 100, weight: 0.24 },
      { name: 'RSI', value: Math.round(rsiSignal * 100) / 100, weight: 0.12 },
      { name: 'Range', value: Math.round(range * 100) / 100, weight: 0.08 },
    ],
  };
}

let scanCache: { at: number; data: Signal[] } | null = null;

export function scan(now = Date.now()): Signal[] {
  if (scanCache && now - scanCache.at < 45_000) return scanCache.data;
  const data = listSymbols()
    .map((def) => signalFor(def))
    .sort((a, b) => Math.abs(b.score) * b.confidence - Math.abs(a.score) * a.confidence);
  scanCache = { at: now, data };
  return data;
}

export function brief(now = Date.now()) {
  const signals = scan(now);
  const bullish = signals.filter((s) => s.score > 0.16).length;
  const bearish = signals.filter((s) => s.score < -0.16).length;
  const neutral = signals.length - bullish - bearish;
  const avg =
    Math.round((signals.reduce((sum, s) => sum + s.score, 0) / signals.length) * 1000) / 1000;
  const top = signals.slice(0, 5);
  const contested = [...signals].sort((a, b) => Math.abs(a.score) - Math.abs(b.score)).slice(0, 3);

  const breadth = (bullish / signals.length) * 100;
  const regime =
    breadth > 60 ? 'Risk-on trend' : breadth > 45 ? 'Mild uptrend' : breadth > 32 ? 'Mixed / range' : 'Risk-off';
  const volatility =
    signals.reduce((sum, s) => sum + s.volatilityPct, 0) / signals.length > 0.7
      ? 'Elevated'
      : signals.reduce((sum, s) => sum + s.volatilityPct, 0) / signals.length > 0.4
        ? 'Normal'
        : 'Compressed';

  return {
    generatedAt: now,
    regime,
    volatility,
    avgScore: avg,
    breadth: Math.round(breadth),
    counts: { bullish, bearish, neutral, total: signals.length },
    top,
    contested,
    notes: [
      `${bullish} of ${signals.length} markets are scoring bullish against ${bearish} bearish — breadth sits at ${Math.round(
        breadth,
      )}%.`,
      `Cross-asset regime reads as ${regime.toLowerCase()} with ${volatility.toLowerCase()} realised volatility.`,
      top.length
        ? `Highest conviction: ${top
            .slice(0, 3)
            .map((s) => `${s.symbol} (${s.label.toLowerCase()}, ${s.confidence}%)`)
            .join(', ')}.`
        : 'No high-conviction setups right now.',
      'Signals are model output on simulated prices for paper trading — not investment advice.',
    ],
  };
}

export { ema, rsi, atr, clamp };
