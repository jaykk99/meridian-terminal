import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Link, navigate } from '../lib/router';
import type { Me, Portfolio as PortfolioType } from '../lib/types';
import { dateShort, money, pct, price, shortAddress, signClass, timeAgo } from '../lib/format';
import { Sparkline } from '../components/Sparkline';
import { AssetBadge } from '../components/ui';

export function Portfolio({
  user,
  requireAuth,
  notify,
  refreshUser,
}: {
  user: Me | null;
  requireAuth: (reason?: string) => void;
  notify: (message: string, kind?: 'success' | 'error') => void;
  refreshUser: () => void;
}) {
  const [data, setData] = useState<PortfolioType | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api
      .portfolio()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        if (err instanceof ApiError && err.status === 401) setData(null);
      });

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return (
      <div className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow">Portfolio</span>
            <h1>Your book</h1>
            <p>Track equity, exposure and every fill in one place.</p>
          </div>
        </div>
        <div className="panel">
          <div className="empty">
            <b>Sign in to open your portfolio</b>
            <p>
              You get $100,000 of simulated capital, instant fills across six asset classes and a
              full trade history.
            </p>
            <button className="btn primary" onClick={() => requireAuth()}>
              Open a terminal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow">Portfolio</span>
            <h1>Your book</h1>
          </div>
        </div>
        <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
      </div>
    );
  }

  const close = async (id: string) => {
    setBusy(id);
    try {
      const res = await api.close(id);
      notify(`Closed · realised ${money(res.pnl)}`, 'success');
      setData(res.portfolio);
      refreshUser();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not close.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const totalReturn = ((data.equity - data.account.startingBalance) / data.account.startingBalance) * 100;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>Your book</h1>
          <p>
            {data.account.provider === 'wallet'
              ? `Trust Wallet · ${shortAddress(data.account.walletAddress ?? '')}`
              : data.account.isGuest
                ? 'Guest session'
                : `@${data.account.login}`}{' '}
            · opened {dateShort(data.account.createdAt)} · simulated capital
          </p>
        </div>
        <div className="row">
          <Link to="/markets" className="btn short">
            New position
          </Link>
          <Link to="/copy" className="btn primary short">
            Copy a desk
          </Link>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span>Equity</span>
          <b>{money(data.equity)}</b>
          <small className={signClass(totalReturn)}>{pct(totalReturn)} all time</small>
        </div>
        <div className="metric">
          <span>Free cash</span>
          <b>{money(data.freeCash)}</b>
          <small>{money(data.usedMargin)} margin in use</small>
        </div>
        <div className="metric">
          <span>Unrealised PnL</span>
          <b className={signClass(data.unrealizedPnl)}>{money(data.unrealizedPnl)}</b>
          <small>{data.openPositions.length} open positions</small>
        </div>
        <div className="metric">
          <span>Realised PnL</span>
          <b className={signClass(data.realizedPnl)}>{money(data.realizedPnl)}</b>
          <small>{data.totalTrades} closed trades</small>
        </div>
      </div>

      <div className="panel mb-4">
        <div className="panel-head">
          <h3>Equity curve</h3>
          <span className="row tiny muted mono" style={{ gap: 12 }}>
            <span>exposure {money(data.exposure)}</span>
            <span>drawdown {data.maxDrawdown.toFixed(1)}%</span>
            <span>win {data.winRate.toFixed(0)}%</span>
          </span>
        </div>
        <div style={{ padding: '14px 16px 8px' }}>
          <Sparkline
            data={data.curve.map((p) => p.v)}
            width={1120}
            height={130}
            color={totalReturn >= 0 ? '#b8ff3d' : '#ff5f6d'}
            fill
            strokeWidth={1.8}
          />
          <div className="row between tiny muted mono" style={{ marginTop: 6 }}>
            <span>{dateShort(data.account.createdAt)}</span>
            <span>start {money(data.account.startingBalance, 0)}</span>
            <span>now {money(data.equity)}</span>
          </div>
        </div>
      </div>

      <div className="panel mb-4">
        <div className="panel-head">
          <h3>Open positions</h3>
          <span className="tiny muted mono">
            {data.buyingPower ? `buying power ${money(data.buyingPower)}` : ''}
          </span>
        </div>
        {data.openPositions.length === 0 ? (
          <div className="empty">
            <b>No open exposure</b>
            <p>Take a setup from the AI desk or open a market view to place your first order.</p>
            <Link to="/ai" className="btn">
              See AI opportunities
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Side</th>
                  <th className="num">Size</th>
                  <th className="num">Entry</th>
                  <th className="num">Mark</th>
                  <th className="num">Margin</th>
                  <th className="num">ROE</th>
                  <th className="num">Liq.</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.openPositions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/trade/${p.symbol}`} className="sym">
                        <AssetBadge symbol={p.symbol} assetClass={p.assetClass} />
                        <span className="sym-name">
                          <b>{p.symbol}</b>
                          <span>{p.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`chip ${p.side === 'long' ? 'buy' : 'sell'}`}>{p.side}</span>
                      <span className="tiny muted mono" style={{ marginLeft: 6 }}>
                        {p.leverage}x
                      </span>
                    </td>
                    <td className="num mono">{money(p.notional)}</td>
                    <td className="num mono">{price(p.entry_price)}</td>
                    <td className="num mono">{price(p.markPrice)}</td>
                    <td className="num mono tiny muted">{money(p.margin)}</td>
                    <td className={`num mono ${signClass(p.roe)}`}>
                      {pct(p.roe, 1)}
                      <div className="tiny muted">{money(p.unrealized)}</div>
                    </td>
                    <td className="num mono tiny down">{price(p.liquidationPrice)}</td>
                    <td>
                      {p.source === 'copy' ? (
                        <span className="tiny" style={{ color: 'var(--accent)' }}>
                          copy · {p.trader_name}
                        </span>
                      ) : (
                        <span className="tiny muted">manual</span>
                      )}
                    </td>
                    <td className="num">
                      <button
                        className="btn short danger"
                        disabled={busy === p.id}
                        onClick={() => void close(p.id)}
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Trade history</h3>
          <span className="tiny muted mono">{data.history.length} recent</span>
        </div>
        {data.history.length === 0 ? (
          <div className="empty">
            <b>Nothing closed yet</b>
            <p>Closed positions and realised PnL will appear here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Side</th>
                  <th className="num">Entry</th>
                  <th className="num">Exit</th>
                  <th className="num">Realised</th>
                  <th>Closed</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="sym-name">
                        <b>{p.symbol}</b>
                        <span>{p.name}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${p.side === 'long' ? 'buy' : 'sell'}`}>{p.side}</span>
                    </td>
                    <td className="num mono">{price(p.entry_price)}</td>
                    <td className="num mono">{p.close_price ? price(p.close_price) : '—'}</td>
                    <td className={`num mono ${signClass(p.realized_pnl ?? 0)}`}>
                      {money(p.realized_pnl ?? 0)}
                    </td>
                    <td className="tiny muted">{p.closed_at ? timeAgo(p.closed_at) : '—'}</td>
                    <td className="tiny muted">
                      {p.source === 'copy' ? `copy · ${p.trader_name}` : 'manual'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
