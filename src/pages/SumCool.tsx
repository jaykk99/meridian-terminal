import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Link } from '../lib/router';
import type { Candle, Me, SumCoolStats } from '../lib/types';
import { compact, feePct, money, pct, price, signClass, timeAgo } from '../lib/format';
import { CandleChart } from '../components/CandleChart';
import { BoltIcon, SparkIcon, WalletIcon } from '../components/Icons';

const INTERVALS = ['15m', '1h', '4h', '1d'];

export function SumCool({
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
  const [stats, setStats] = useState<SumCoolStats | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setInterval] = useState('1h');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState<null | 'claim' | 'trade'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .sumCool()
        .then((res) => {
          if (alive) setStats(res);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .candles('COOLUSD', interval, 160)
        .then((res) => {
          if (alive) setCandles(res.candles);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 25_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [interval]);

  const claim = async () => {
    if (!user) {
      requireAuth(`Sign in to claim ${stats?.claimAmount ?? 500} free Sum Cool.`);
      return;
    }
    setBusy('claim');
    setError(null);
    try {
      const res = await api.claimCool();
      setStats(res.stats);
      refreshUser();
      notify(`Claimed ${res.amount.toLocaleString()} COOL — fee discount unlocked.`, 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not claim COOL.');
    } finally {
      setBusy(null);
    }
  };

  const trade = async () => {
    if (!user) {
      requireAuth('Sign in to buy or sell Sum Cool.');
      return;
    }
    setBusy('trade');
    setError(null);
    try {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount.');
      const res =
        mode === 'buy'
          ? await api.tradeCool({ action: 'buy', usd: value })
          : await api.tradeCool({ action: 'sell', amount: value });
      setStats(res.stats);
      refreshUser();
      notify(
        mode === 'buy'
          ? `Bought ${(res.tokens ?? 0).toFixed(2)} COOL at ${money(res.price, 4)}`
          : `Sold for ${money(res.proceeds ?? 0)} at ${money(res.price, 4)}`,
        'success',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const tier = stats?.feeTier;
  const supplyRows = [
    { label: 'Community & claims', pct: 42, hue: 78 },
    { label: 'Liquidity', pct: 24, hue: 168 },
    { label: 'Treasury', pct: 18, hue: 212 },
    { label: 'Team', pct: 10, hue: 286 },
    { label: 'Advisors', pct: 6, hue: 42 },
  ];

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <SparkIcon size={12} /> Platform token
          </span>
          <h1>Sum Cool</h1>
          <p>
            COOL is Meridian's in-app token: claim it free, trade it like any other market, and
            hold it to cut trading fees — all the way to zero. It lives on this terminal only.
          </p>
        </div>
        <div className="row" style={{ gap: 18 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 26, letterSpacing: '-0.03em' }}>
              {stats ? money(stats.price, 4) : '—'}
            </div>
            <div className={`mono small ${stats ? signClass(stats.change24h) : ''}`}>
              {stats ? pct(stats.change24h) : '—'} · 24h
            </div>
          </div>
          <span className="tag">COOL/USD</span>
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
              <span className="tiny muted mono">{candles.length} bars</span>
            </div>
            <div className="chart-shell">
              <CandleChart candles={candles} height={300} loading={!candles.length} />
            </div>
          </div>

          <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="metric">
              <span>Market cap</span>
              <b>{stats ? `$${compact(stats.marketCap)}` : '—'}</b>
              <small>circulating {stats ? compact(stats.circulating) : '—'} COOL</small>
            </div>
            <div className="metric">
              <span>Fully diluted</span>
              <b>{stats ? `$${compact(stats.fdv)}` : '—'}</b>
              <small>{stats ? compact(stats.supply) : '—'} fixed supply</small>
            </div>
            <div className="metric">
              <span>Holders</span>
              <b>{stats ? stats.holders.toLocaleString() : '—'}</b>
              <small>wallets with a COOL balance</small>
            </div>
            <div className="metric">
              <span>Base fee</span>
              <b>{feePct(stats?.baseFeeRate ?? 0.00005)}</b>
              <small>{user ? `${tier?.label ?? 'Standard'} tier active` : 'holding COOL cuts this'}</small>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Your COOL</h3>
              <span className="tiny muted mono">
                {tier ? `${feePct(tier.rate)} effective fee` : 'sign in to see your tier'}
              </span>
            </div>
            <div className="panel-body">
              <div className="row between wrap" style={{ gap: 16, marginBottom: 14 }}>
                <div>
                  <div className="tiny muted">Balance</div>
                  <div className="mono" style={{ fontSize: 26 }}>
                    {stats ? stats.balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}{' '}
                    <span className="small muted">COOL</span>
                  </div>
                </div>
                <div style={{ minWidth: 180 }}>
                  <div className="row between small">
                    <span className="muted">{tier?.label ?? 'Standard'} tier</span>
                    <span className="mono">{tier ? `${tier.discountPct}% off` : '—'}</span>
                  </div>
                  <div className="bar-track" style={{ marginTop: 6 }}>
                    <div
                      className="bar-fill"
                      style={{
                        width: `${tier?.progress ?? 0}%`,
                        background: 'linear-gradient(90deg, var(--teal), var(--accent))',
                      }}
                    />
                  </div>
                  <div className="tiny muted" style={{ marginTop: 5 }}>
                    {tier?.nextAt
                      ? `${tier.nextAt.toLocaleString()} COOL unlocks ${tier.nextLabel}`
                      : 'Top tier — you pay zero fees'}
                  </div>
                </div>
                <div>
                  <button className="btn primary" onClick={() => void claim()} disabled={busy !== null || Boolean(stats?.claimed)}>
                    {busy === 'claim' ? <span className="spin" /> : <BoltIcon size={15} />}
                    {stats?.claimed ? 'Claimed' : `Claim ${stats?.claimAmount ?? 500} free`}
                  </button>
                  <div className="tiny muted" style={{ marginTop: 5 }}>
                    one claim per account
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 14, alignItems: 'start' }}>
                <div className="stack">
                  <div className="segmented" style={{ width: '100%' }}>
                    <button className={`long ${mode === 'buy' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => { setMode('buy'); setAmount('100'); }}>
                      Buy
                    </button>
                    <button className={`shorting ${mode === 'sell' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => { setMode('sell'); setAmount(stats ? String(Math.min(stats.balance, 100)) : '100'); }}>
                      Sell
                    </button>
                  </div>
                  <div className="field">
                    <label>{mode === 'buy' ? 'Spend (USD)' : 'Sell (COOL)'}</label>
                    <div className="input-group">
                      <input
                        className="input mono"
                        value={amount}
                        inputMode="decimal"
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      />
                      <span className="suffix">{mode === 'buy' ? 'USD' : 'COOL'}</span>
                    </div>
                  </div>
                  <button className="btn primary block" onClick={() => void trade()} disabled={busy !== null || !stats}>
                    {busy === 'trade' ? <span className="spin" /> : <WalletIcon size={15} />}
                    {mode === 'buy' ? 'Buy COOL' : 'Sell COOL'}
                  </button>
                  {error && <div className="notice">{error}</div>}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <p className="small muted" style={{ margin: 0, lineHeight: 1.65 }}>
                    Buy or sell at the live simulated price. Holding thresholds are checked
                    instantly, so a purchase can upgrade your fee tier on the very next trade.
                  </p>
                  <div className="level">
                    <span>Est. fee on a $10,000 order</span>
                    <b>{stats ? money(10000 * stats.feeTier.rate) : '—'}</b>
                  </div>
                  <div className="level">
                    <span>Buying power</span>
                    <b>{money(user?.balance ?? 0)}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Recent claims</h3>
              <span className="tiny muted mono">last 8</span>
            </div>
            {stats && stats.recentClaims.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="num">COOL</th>
                      <th className="num">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentClaims.map((claim, i) => (
                      <tr key={`${claim.at}-${i}`}>
                        <td className="mono small">{claim.name}</td>
                        <td className="num mono up">+{claim.amount.toLocaleString()}</td>
                        <td className="num tiny muted">{timeAgo(claim.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty" style={{ padding: '28px 20px' }}>
                <b>No claims yet</b>
                <p>Be the first to claim the free allocation.</p>
              </div>
            )}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="panel" style={{ padding: 20 }}>
            <span className="eyebrow" style={{ marginBottom: 8 }}>
              Fee tiers
            </span>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Hold COOL, pay less</h3>
            <div className="stack" style={{ gap: 9 }}>
              {[
                ['Standard', '0+', feePct(stats?.baseFeeRate ?? 0.00005)],
                ['Silver', '500', feePct((stats?.baseFeeRate ?? 0.00005) * 0.75)],
                ['Gold', '1,500', feePct((stats?.baseFeeRate ?? 0.00005) * 0.5)],
                ['Fee-free', '5,000', '0%'],
              ].map(([label, min, rate]) => (
                <div className="row between small" key={label}>
                  <span className={tier?.label === label ? 'up' : 'muted'}>
                    {label} · {min} COOL
                  </span>
                  <span className="mono">{rate}</span>
                </div>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
              The discount applies to entry and exit fees on every market, automatically.
            </p>
          </div>

          <div className="panel" style={{ padding: 20 }}>
            <span className="eyebrow" style={{ marginBottom: 8 }}>
              Tokenomics
            </span>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Fixed 100M supply</h3>
            <div className="stack" style={{ gap: 8 }}>
              {supplyRows.map((row) => (
                <div key={row.label}>
                  <div className="row between tiny">
                    <span className="muted">{row.label}</span>
                    <span className="mono">{row.pct}%</span>
                  </div>
                  <div className="bar-track" style={{ marginTop: 4, height: 4 }}>
                    <div
                      className="bar-fill"
                      style={{
                        width: `${row.pct}%`,
                        background: `hsl(${row.hue}, 70%, 58%)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>What it's for</h3>
            <ul className="rationale" style={{ gap: 7 }}>
              <li>Trading fee discounts, up to fee-free at 5,000 COOL.</li>
              <li>Access to higher copy-trading allocations as tiers grow.</li>
              <li>Governance votes on new listings and fee parameters.</li>
            </ul>
            <Link to="/markets" className="btn ghost short mt-4">
              Trade {stats?.symbol ?? 'COOLUSD'} in the terminal
            </Link>
          </div>
        </div>
      </div>

      <p className="disclaimer">
        Sum Cool is a simulated in-app token with no blockchain, no monetary value, no transfer or
        withdrawal, and no promise of future value. Claiming and trading COOL happens entirely
        inside this paper-trading environment.
      </p>
    </div>
  );
}
