import type {
  Brief,
  Candle,
  CopySubscription,
  Me,
  Overview,
  Portfolio,
  Position,
  Quote,
  Signal,
  SumCoolStats,
  SymbolMeta,
  Trader,
} from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ??
      (res.status === 401 ? 'Sign in to continue.' : 'Request failed.');
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const api = {
  config: () =>
    request<{ walletConnectProjectId: string | null; githubConfigured: boolean }>('/api/config'),
  me: () => request<{ user: Me | null; githubConfigured: boolean }>('/api/me'),
  guest: () => request<{ user: Me }>('/api/auth/guest', { method: 'POST' }),
  walletChallenge: (address: string) =>
    request<{ message: string }>('/api/auth/wallet/challenge', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),
  walletLogin: (address: string, signature: string) =>
    request<{ user: Me }>('/api/auth/wallet', {
      method: 'POST',
      body: JSON.stringify({ address, signature }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  symbols: () =>
    request<{ classes: string[]; symbols: SymbolMeta[]; intervals: string[] }>(
      '/api/market/symbols',
    ),
  quotes: (symbols?: string[], spark = true) => {
    const qs = new URLSearchParams();
    if (symbols?.length) qs.set('symbols', symbols.join(','));
    if (!spark) qs.set('spark', '0');
    return request<{ at: number; quotes: Quote[] }>(`/api/market/quotes?${qs.toString()}`);
  },
  overview: () => request<Overview>('/api/market/overview'),
  candles: (symbol: string, interval: string, limit = 180) =>
    request<{ symbol: string; interval: string; candles: Candle[] }>(
      `/api/market/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    ),

  portfolio: () => request<Portfolio>('/api/portfolio'),
  order: (body: {
    symbol: string;
    side: 'long' | 'short';
    margin: number;
    leverage: number;
    tp?: number | null;
    sl?: number | null;
  }) =>
    request<{ position: Position; portfolio: Portfolio }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  close: (id: string) =>
    request<{ pnl: number; portfolio: Portfolio }>(`/api/orders/${id}/close`, {
      method: 'POST',
    }),

  watchlist: () => request<{ symbols: string[] }>('/api/watchlist'),
  addWatch: (symbol: string) =>
    request<{ ok: boolean }>('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),
  removeWatch: (symbol: string) =>
    request<{ ok: boolean }>(`/api/watchlist/${symbol}`, { method: 'DELETE' }),

  traders: () => request<{ traders: Trader[] }>('/api/copy/traders'),
  trader: (id: string) => request<Trader>(`/api/copy/traders/${id}`),
  myCopies: () =>
    request<{
      subscriptions: CopySubscription[];
      copies: Position[];
      equity: number;
      freeCash: number;
    }>('/api/copy/mine'),
  startCopy: (traderId: string, allocation: number) =>
    request<{ id: string; subscriptions: CopySubscription[]; portfolio: Portfolio }>('/api/copy', {
      method: 'POST',
      body: JSON.stringify({ traderId, allocation }),
    }),
  stopCopy: (id: string) =>
    request<{ subscriptions: CopySubscription[]; portfolio: Portfolio }>(`/api/copy/${id}/stop`, {
      method: 'POST',
    }),

  sumCool: () => request<SumCoolStats>('/api/sumcool'),
  claimCool: () =>
    request<{ amount: number; stats: SumCoolStats; user: Me }>('/api/sumcool/claim', {
      method: 'POST',
    }),
  tradeCool: (body: { action: 'buy' | 'sell'; usd?: number; amount?: number }) =>
    request<{
      tokens?: number;
      proceeds?: number;
      price: number;
      stats: SumCoolStats;
      user: Me;
    }>('/api/sumcool/trade', { method: 'POST', body: JSON.stringify(body) }),

  scanner: () => request<{ at: number; signals: Signal[]; brief: Brief }>('/api/ai/scanner'),
  signal: (symbol: string) => request<Signal>(`/api/ai/signal/${encodeURIComponent(symbol)}`),
  brief: () => request<Brief>('/api/ai/brief'),
};
