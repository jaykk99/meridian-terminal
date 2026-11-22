export interface Quote {
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  spark: number[];
}

export interface SymbolMeta {
  symbol: string;
  name: string;
  assetClass: string;
  maxLeverage: number;
  marketStatus: string;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

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

export interface Brief {
  generatedAt: number;
  regime: string;
  volatility: string;
  avgScore: number;
  breadth: number;
  counts: { bullish: number; bearish: number; neutral: number; total: number };
  top: Signal[];
  contested: Signal[];
  notes: string[];
}

export interface Me {
  id: string;
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  balance: number;
  startingBalance: number;
  createdAt: number;
  walletAddress: string | null;
  provider: 'github' | 'wallet' | 'guest';
}

export interface Position {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  side: 'long' | 'short';
  qty: number;
  entry_price: number;
  leverage: number;
  margin: number;
  notional: number;
  tp: number | null;
  sl: number | null;
  markPrice: number;
  unrealized: number;
  roe: number;
  liquidationPrice: number;
  source: 'manual' | 'copy';
  trader_id: string | null;
  trader_name: string | null;
  opened_at: number;
  closed_at: number | null;
  realized_pnl?: number;
  close_price?: number | null;
}

export interface Portfolio {
  account: Me;
  equity: number;
  freeCash: number;
  unrealizedPnl: number;
  realizedPnl: number;
  usedMargin: number;
  exposure: number;
  buyingPower: number;
  feeRate: number;
  coolBalance: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  openPositions: Position[];
  history: Position[];
  curve: { t: number; v: number }[];
}

export interface TraderBookPosition {
  symbol: string;
  name: string;
  assetClass: string;
  side: 'long' | 'short';
  entryPrice: number;
  markPrice: number;
  returnPct: number;
  openedAt: number;
  closesAt: number;
  leverage: number;
}

export interface Trader {
  id: string;
  name: string;
  handle: string;
  strategy: string;
  risk: 'Low' | 'Moderate' | 'High' | 'Aggressive';
  universe: string[];
  leverage: number;
  hue: number;
  bio: string;
  roi30d: number;
  winRate: number;
  followers: number;
  aum: number;
  traded30d: number;
  avgHoldHours: number;
  riskScore: number;
  openPositions: TraderBookPosition[];
  copying?: boolean;
}

export interface CopySubscription {
  id: string;
  allocation: number;
  startedAt: number;
  lastSync: number;
  trader: Trader | null;
  mirroredOpen: number;
  mirroredClosed: number;
  mirroredPnl: number;
}

export interface SumCoolStats {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  supply: number;
  circulating: number;
  marketCap: number;
  fdv: number;
  holders: number;
  claimAmount: number;
  balance: number;
  claimed: boolean;
  baseFeeRate: number;
  feeTier: {
    label: string;
    blurb: string;
    discountPct: number;
    rate: number;
    nextAt: number | null;
    nextLabel: string | null;
    progress: number;
  };
  recentClaims: { name: string; amount: number; at: number }[];
}

export interface Overview {
  at: number;
  totalMarkets: number;
  totalVolume: number;
  advancing: number;
  declining: number;
  byClass: {
    assetClass: string;
    count: number;
    avgChange: number;
    volume: number;
    advancing: number;
    declining: number;
  }[];
  gainers: Quote[];
  losers: Quote[];
  ticker: Quote[];
}
