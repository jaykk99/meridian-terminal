import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Link, navigate } from '../lib/router';
import type { Candle, Me, Portfolio, Quote, Signal } from '../lib/types';
import { feePct, money, pct, price, signClass, timeAgo } from '../lib/format';
import { CandleChart } from '../components/CandleChart';
import { Sparkline } from '../components/Sparkline';
import { AssetBadge } from '../components/ui';

const INTERVALS = ['5m', '15m', '1h', '4h', '1d'];

export function Trade({
  symbol,
  user,
  requireAuth,
  notify,
  refreshUser,
}: {
  symbol: string;
  user: Me | null;
  requireAuth: (reason?: string) => void;
  notify: (message: string, kind?: 'success' | 'error') => void;
  refreshUser: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [meta, setMeta] = useState<{ maxLeverage: number; marketStatus: string; name: string } | null>(
    null,
  );
  const [interval, setInterval] = useState('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [margin, setMargin] = useState('500');
  const [leverage, setLeverage] = useState(2);
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // market metadata
  useEffect(() => {
    api
      .symbols()
      .then((res) => {
        const found = res.symbols.find((s) => s.symbol === symbol);
        if (found) {
          setMeta({
            maxLeverage: found.maxLeverage,
            marketStatus: found.marketStatus,
            name: found.name,
          });
          setLeverage(Math.min(2, found.maxLeverage));
        } else {
          setNotFound(true);
        }
      })
      .catch(() => undefined);
  }, [symbol]);

  // live quote
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .quotes([symbol])
        .then((res) => {
          if (alive) setQuote(res.quotes[0] ?? null);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [symbol]);

  // candles
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .candles(symbol, interval, 180)
        .then((res) => {
          if (alive) setCandles(res.candles);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 20_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [symbol, interval]);

  // ai signal
  useEffect(() => {
    setSignal(null);
    api
      .signal(symbol)
      .then(setSignal)
      .catch(() => undefined);
  }, [symbol]);

  // portfolio
  const loadPortfolio = () =>
    api
      .portfolio()
      .then(setPortfolio)
      .catch(() => undefined);

  useEffect(() => {
    if (!user) {
      setPortfolio(null);
      return;
    }
    void loadPortfolio();
    const timer = window.setInterval(() => void loadPortfolio(), 6000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const maxLeverage = meta?.maxLeverage ?? 10;
  const px = quote?.price ?? signal?.price ?? 0;
  const marginNum = Number(margin) || 0;
  const notional = marginNum * leverage;
  const feeRate = portfolio?.feeRate ?? 0.00005;
  const fee = notional * feeRate;
  const qty = px > 0 ? notional / px : 0;
  const liqPrice = px > 0 ? (side === 'long' ? px * (1 - 0.9 / leverage) : px * (1 + 0.9 / leverage)) : 0;
  const freeCash = portfolio?.freeCash ?? user?.balance ?? 0;

  const openOnSymbol = useMemo(
    () => portfolio?.openPositions.filter((p) => p.symbol === symbol) ?? [],
    [portfolio, symbol],
  );

  const placeOrder = async () => {
    if (!user) {
      requireAuth('Sign in to place a trade.');
      return;
    }
    setError(null);
    if (marginNum < 10) {
      setError('Minimum margin is $10.');
      return;
    }
    if (marginNum + fee > freeCash) {
      setError(`Not enough free cash. Available ${money(freeCash)}.`);
      return;
    }
    setBusy(true);
    try {
      await api.order({
        symbol,
        side,
        margin: marginNum,
        leverage,
        tp: tp ? Number(tp) : null,
        sl: sl ? Number(sl) : null,
      });
      notify(`${side === 'long' ? 'Long' : 'Short'} ${symbol} opened · ${money(notional)} notional`, 'success');
      setError(null);
      setTp('');
      setSl('');
      await loadPortfolio();
      refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Order failed.');
    } finally {
      setBusy(false);
    }
  };

  const close = async (id: string) => {
    setBusy(true);
    try {
      const res = await api.close(id);
      notify(`Position closed · realised ${money(res.pnl)}`, 'success');
      setPortfolio(res.portfolio);
      refreshUser();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not close position.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <div className="container">
        <div className="empty" style={{ paddingTop: 100 }}>
          <b>Market not found</b>
          <p>That symbol is not in the Meridian universe.</p>
          <button className="btn" onClick={() => navigate('/markets')}>
            Back to markets
          </button>
        </div>
      </div>
    );
  }

  const change = quote?.change24h ?? 0;

  return (
    <div className="container">
      <div className="row between wrap" style={{ padding: '20px 0 14px', gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <AssetBadge symbol={symbol} assetClass={signal?.assetClass ?? 'Crypto'} />
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.03em' }}>{symbol}</h1>
              <span className="tag">{signal?.assetClass ?? 'Market'}</span>
              <span className="pill dot">{meta?.marketStatus ?? '24/7'}</span>
            </div>
            <div className="small muted" style={{ marginTop: 3 }}>
              {meta?.name ?? quote?.name} · max {maxLeverage}x
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 18 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 26, letterSpacing: '-0.03em' }}>
              {px ? price(px) : '—'}
            </div>
            <div className={`mono small ${signClass(change)}`}>{pct(change)} · 24h</div>
          </div>
          <div className="stack small mono muted" style={{ gap: 2, textAlign: 'right' }}>
            <span>H {quote ? price(quote.high24h) : '—'}</span>
            <span>L {quote ? price(quote.low24h) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="trade-grid">
        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <div className="row between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <div className="row" style={{ gap: 4 }}>
                {INTERVALS.map((iv) => (
                  <button
                    key={iv}
                    className={`btn short ${interval === iv ? '' : 'ghost'}`}
                    style={
                      interval === iv
                        ? { background: 'rgba(255,255,255,0.09)', borderColor: 'var(--line-strong)' }
                        : { border: 'none' }
                    }
                    onClick={() => setInterval(iv)}
                  >
                    {iv}
                  </button>
                ))}
              </div>
              <div className="row tiny muted mono" style={{ gap: 8 }}>
                {quote?.spark?.length ? (
                  <Sparkline
                    data={quote.spark}
                    width={90}
                    height={22}
                    color={change >= 0 ? '#3ee08b' : '#ff5f6d'}
                  />
                ) : null}
                <span>{candles.length} bars</span>
              </div>
            </div>
            <div className="chart-shell">
              <CandleChart candles={candles} height={352} loading={!candles.length} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>AI analysis</h3>
              <span className="tiny muted mono">
                {signal ? `${signal.horizon} · conf ${signal.confidence}%` : 'computing…'}
              </span>
            </div>
            <div className="panel-body">
              {signal ? (
                <>
                  <div className="score-hero">
                    <div className="gauge">
                      <svg width={74} height={74}>
                        <circle cx={37} cy={37} r={30} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
                        <circle
                          cx={37}
                          cy={37}
                          r={30}
                          stroke={signal.score >= 0 ? 'var(--up)' : 'var(--down)'}
                          strokeWidth={5}
                          fill="none"
                          strokeDasharray={`${(signal.confidence / 100) * 188.5} 188.5`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>{signal.confidence}%</span>
                    </div>
                    <div>
                      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                        <span className={`chip ${signal.score > 0.16 ? 'buy' : signal.score < -0.16 ? 'sell' : 'neutral'}`}>
                          {signal.label}
                        </span>
                        <span className="mono small muted">score {signal.score.toFixed(2)}</span>
                      </div>
                      <div className="small muted">
                        Trend {signal.trend} · RSI {signal.rsi} · 1h vol {signal.volatilityPct}%
                      </div>
                    </div>
                  </div>

                  <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
                    {signal.drivers.map((d) => (
                      <div className="driver" key={d.name}>
                        <span>{d.name}</span>
                        <span className="track">
                          <span
                            className="fill"
                            style={{
                              width: `${Math.min(100, Math.abs(d.value) * 100)}%`,
                              background: d.value >= 0 ? 'var(--up)' : 'var(--down)',
                              marginLeft: d.value >= 0 ? '50%' : undefined,
                              display: 'block',
                            }}
                          />
                        </span>
                        <span className="mono" style={{ textAlign: 'right' }}>
                          {d.value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="levels mb-4">
                    <div className="level">
                      <span>Target</span>
                      <b className="up">{price(signal.target)}</b>
                    </div>
                    <div className="level">
                      <span>Invalidation</span>
                      <b className="down">{price(signal.invalidation)}</b>
                    </div>
                    <div className="level">
                      <span>Support</span>
                      <b>{price(signal.support)}</b>
                    </div>
                    <div className="level">
                      <span>Resistance</span>
                      <b>{price(signal.resistance)}</b>
                    </div>
                  </div>

                  <ul className="rationale">
                    {signal.rationale.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="skeleton" style={{ height: 200 }} />
              )}
            </div>
          </div>

          {openOnSymbol.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h3>Your {symbol} positions</h3>
                <Link to="/portfolio" className="tiny muted">
                  Portfolio
                </Link>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Side</th>
                      <th className="num">Entry</th>
                      <th className="num">Mark</th>
                      <th className="num">PnL</th>
                      <th>Opened</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {openOnSymbol.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className={`chip ${p.side === 'long' ? 'buy' : 'sell'}`}>{p.side}</span>
                          <span className="tiny muted mono" style={{ marginLeft: 6 }}>
                            {p.leverage}x
                          </span>
                        </td>
                        <td className="num mono">{price(p.entry_price)}</td>
                        <td className="num mono">{price(p.markPrice)}</td>
                        <td className={`num mono ${signClass(p.unrealized)}`}>
                          {money(p.unrealized)} ({pct(p.roe, 1)})
                        </td>
                        <td className="tiny muted">{timeAgo(p.opened_at)}</td>
                        <td className="num">
                          <button className="btn short danger" disabled={busy} onClick={() => void close(p.id)}>
                            Close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="order-panel">
          <div className="panel">
            <div className="panel-head">
              <h3>Order ticket</h3>
              <span className="tiny muted mono">{user ? `cash ${money(freeCash)}` : 'signed out'}</span>
            </div>
            <div className="panel-body">
              <div className="segmented" style={{ width: '100%', marginBottom: 16 }}>
                <button
                  className={`long ${side === 'long' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setSide('long')}
                >
                  Long
                </button>
                <button
                  className={`shorting ${side === 'short' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setSide('short')}
                >
                  Short
                </button>
              </div>

              <div className="field">
                <label>Margin</label>
                <div className="input-group">
                  <input
                    className="input mono"
                    value={margin}
                    inputMode="decimal"
                    onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                  <span className="suffix">USD</span>
                </div>
                <div className="quick">
                  {[0.1, 0.25, 0.5, 1].map((f) => (
                    <button
                      key={f}
                      onClick={() =>
                        // Size so margin + fee fits inside f of free cash.
                        setMargin(
                          String(
                            Math.max(
                              10,
                              Math.floor((freeCash * f) / (1 + feeRate * leverage)),
                            ),
                          ),
                        )
                      }
                    >
                      {f === 1 ? 'Max' : `${f * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="leverage-row">
                  <span>Leverage</span>
                  <b>{leverage}x</b>
                </div>
                <input
                  className="slider"
                  type="range"
                  min={1}
                  max={maxLeverage}
                  step={1}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                />
                <div className="row between tiny muted mono" style={{ marginTop: 4 }}>
                  <span>1x</span>
                  <span>{maxLeverage}x max</span>
                </div>
              </div>

              <div className="grid-2 mt-4" style={{ gap: 8 }}>
                <div className="field">
                  <label>Take profit</label>
                  <input
                    className="input mono"
                    placeholder="optional"
                    value={tp}
                    inputMode="decimal"
                    onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                </div>
                <div className="field">
                  <label>Stop loss</label>
                  <input
                    className="input mono"
                    placeholder="optional"
                    value={sl}
                    inputMode="decimal"
                    onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                </div>
              </div>

              <div className="summary">
                <div className="line">
                  <span>Position size</span>
                  <b>{money(notional)}</b>
                </div>
                <div className="line">
                  <span>Quantity</span>
                  <b>{qty > 0 ? qty.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—'}</b>
                </div>
                <div className="line">
                  <span>Entry (est.)</span>
                  <b>{px ? price(px) : '—'}</b>
                </div>
                <div className="line">
                  <span>Liquidation</span>
                  <b className="down">{px ? price(liqPrice) : '—'}</b>
                </div>
                <div className="line">
                  <span>Fee ({feePct(feeRate)})</span>
                  <b>{money(fee)}</b>
                </div>
              </div>

              {error && <div className="notice mb-4">{error}</div>}

              {user ? (
                <button
                  className={`btn block ${side === 'long' ? 'primary' : 'danger'}`}
                  disabled={busy || !px}
                  onClick={() => void placeOrder()}
                  style={{ padding: '12px 16px' }}
                >
                  {busy ? <span className="spin" /> : null}
                  {side === 'long' ? 'Buy / Long' : 'Sell / Short'} {symbol}
                </button>
              ) : (
                <button
                  className="btn primary block"
                  onClick={() => requireAuth('Sign in to place a trade.')}
                  style={{ padding: '12px 16px' }}
                >
                  Sign in to trade
                </button>
              )}

              <p className="tiny" style={{ color: 'var(--muted-2)', marginTop: 10, lineHeight: 1.55 }}>
                Isolated margin. The position is liquidated if losses reach ~90% of margin. Paper
                trading only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
