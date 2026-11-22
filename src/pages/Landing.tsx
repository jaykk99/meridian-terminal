import { useAsync } from '../lib/hooks';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { Me } from '../lib/types';
import { compactMoney, pct, price, signClass } from '../lib/format';
import { Sparkline } from '../components/Sparkline';
import { AssetBadge, RiskBars, ScoreChip, TraderAvatar } from '../components/ui';
import {
  ArrowIcon,
  BoltIcon,
  ChartIcon,
  CopyIcon,
  GlobeIcon,
  LayersIcon,
  ShieldIcon,
  SparkIcon,
} from '../components/Icons';

export function Landing({ user, onStart }: { user: Me | null; onStart: () => void }) {
  const { data: overview } = useAsync(() => api.overview(), []);
  const { data: scan } = useAsync(() => api.scanner(), []);
  const { data: btc } = useAsync(() => api.candles('BTCUSD', '1h', 72), []);
  const { data: traders } = useAsync(() => api.traders(), []);
  const { data: cool } = useAsync(() => api.sumCool(), []);

  const topSignals = scan?.signals.slice(0, 4) ?? [];
  const btcCloses = btc?.candles.map((c) => c.c) ?? [];
  const breadth = scan?.brief.breadth ?? 50;

  return (
    <div className="container">
      <section className="hero">
        <div>
          <span className="eyebrow">
            <SparkIcon size={12} /> AI-native trading terminal
          </span>
          <h1>
            Every market.
            <br />
            <span className="grad">One terminal.</span>
          </h1>
          <p className="lede">
            Meridian pairs a live AI signal desk with a full multi-asset trading engine — crypto,
            equities, FX, indices, commodities and ETFs — inside one account. Mirror proven
            strategies automatically, and practise with $100,000 of simulated capital.
          </p>
          <div className="hero-actions">
            <button className="btn primary" onClick={onStart} style={{ padding: '12px 20px' }}>
              {user ? 'Enter the terminal' : 'Open a free terminal'} <ArrowIcon />
            </button>
            <Link
              to="/markets"
              className="btn"
              style={{ padding: '12px 20px' }}
            >
              Browse {overview?.totalMarkets ?? 346} markets
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <i /> 6 asset classes
            </span>
            <span>
              <i /> GitHub + Trust Wallet
            </span>
            <span>
              <i /> Copy trading
            </span>
            <span>
              <i /> Paper capital only
            </span>
          </div>
        </div>

        <div className="desk-card">
          <div className="desk-top">
            <div>
              <div className="desk-title">AI desk · live scan</div>
              <div className="row tiny muted mono" style={{ marginTop: 4, gap: 6 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'inline-block',
                  }}
                />
                ensemble v2 · 5 models
              </div>
            </div>
            <span className={`chip ${breadth >= 50 ? 'buy' : 'sell'}`}>
              {breadth >= 50 ? 'Risk-on' : 'Risk-off'} {breadth}%
            </span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <Sparkline
              data={btcCloses}
              width={520}
              height={88}
              color="#b8ff3d"
              fill
              strokeWidth={1.6}
              responsive
            />
          </div>

          {topSignals.length === 0
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className="scan-row">
                  <div className="skeleton" style={{ height: 14, width: 110 }} />
                  <div className="skeleton" style={{ height: 14, width: 60 }} />
                  <div className="skeleton" style={{ height: 14, width: 54 }} />
                </div>
              ))
            : topSignals.map((s) => (
                <Link to={`/trade/${s.symbol}`} key={s.symbol} className="scan-row">
                  <span className="row" style={{ gap: 8, minWidth: 0 }}>
                    <b style={{ fontSize: 12.5, fontWeight: 600 }}>{s.symbol}</b>
                    <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </span>
                  </span>
                  <span className="mono tiny">{price(s.price)}</span>
                  <span className={`chip ${s.score > 0 ? 'buy' : 'sell'}`}>
                    {s.confidence}%
                  </span>
                </Link>
              ))}

          <div className="row between tiny" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', color: 'var(--muted-2)' }}>
            <span>{scan?.brief.regime ?? 'Scanning'} · {scan?.brief.volatility ?? '—'} vol</span>
            <span className="mono">{scan?.brief.counts.bullish ?? 0} bullish / {scan?.brief.counts.bearish ?? 0} bearish</span>
          </div>
        </div>
      </section>

      <div className="stats-strip" style={{ marginBottom: 8 }}>
        <div className="stat">
          <div className="k">Tradeable markets</div>
          <div className="v">{overview?.totalMarkets ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="k">Asset classes</div>
          <div className="v">{overview?.byClass.length ?? 6}</div>
        </div>
        <div className="stat">
          <div className="k">Strategies to copy</div>
          <div className="v">{traders?.traders.length ?? 16}</div>
        </div>
        <div className="stat">
          <div className="k">Paper capital</div>
          <div className="v">$100,000</div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>An institutional desk, wired into one screen</h2>
            <p>
              The same primitives a professional book runs on: a multi-model signal engine, an
              all-asset execution panel and a copy-trading rail — without the terminal license.
            </p>
          </div>
        </div>
        <div className="feature-grid">
          <div className="feature">
            <div className="ico">
              <SparkIcon size={17} />
            </div>
            <h3>AI signal ensemble</h3>
            <p>
              Trend, structure, momentum, RSI and range models score every market on every tick.
              Each call ships with confidence, targets, invalidation and the reasoning behind it.
            </p>
          </div>
          <div className="feature">
            <div className="ico">
              <GlobeIcon size={17} />
            </div>
            <h3>All markets, one balance</h3>
            <p>
              {overview?.totalMarkets ?? 346} instruments across crypto, US equities, FX, global
              indices, commodities and ETFs. Long or short, up to 20x, from a single dollar
              balance.
            </p>
          </div>
          <div className="feature">
            <div className="ico">
              <CopyIcon size={17} />
            </div>
            <h3>Copy trading, auto-mirrored</h3>
            <p>
              Allocate to a strategy and new entries are mirrored into your account with
              proportional sizing. Every copy shows its live book, risk score and modelled
              drawdown.
            </p>
          </div>
          <div className="feature">
            <div className="ico">
              <ShieldIcon size={17} />
            </div>
            <h3>Risk controls built in</h3>
            <p>
              Take-profit and stop-loss on every order, isolated margin per position, automatic
              liquidation protection and a live exposure read-out.
            </p>
          </div>
          <div className="feature">
            <div className="ico">
              <BoltIcon size={17} />
            </div>
            <h3>Signals to fills in one click</h3>
            <p>
              Every AI idea deep-links into the order panel with the market, side and levels
              pre-loaded. Review size, leverage and fees before you send it.
            </p>
          </div>
          <div className="feature">
            <div className="ico">
              <LayersIcon size={17} />
            </div>
            <h3>Transparent performance</h3>
            <p>
              Equity curve, win rate, realised vs unrealised PnL and max drawdown are computed
              from your own fills — not a marketing number.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Six asset classes. One order ticket.</h2>
            <p>Cross-asset coverage with per-class leverage limits and live 24h breadth.</p>
          </div>
          <Link to="/markets" className="btn short">
            All markets <ArrowIcon />
          </Link>
        </div>
        <div className="class-grid">
          {(overview?.byClass ?? []).map((row) => (
            <Link to={`/markets?class=${row.assetClass}`} key={row.assetClass} className="class-card">
              <div>
                <b>{row.assetClass}</b>
                <span>{row.count} instruments · {row.advancing} up / {row.declining} down</span>
              </div>
              <span className={`mono small ${signClass(row.avgChange)}`}>{pct(row.avgChange)}</span>
            </Link>
          ))}
          {!overview &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <div className="class-card" key={i}>
                <div className="skeleton" style={{ height: 30, width: 160 }} />
              </div>
            ))}
        </div>
        <div className="grid-2 mt-4">
          <div className="panel">
            <div className="panel-head">
              <h3>Top gainers · 24h</h3>
              <Link to="/markets" className="tiny muted">
                Full board
              </Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {(overview?.gainers ?? []).map((q) => (
                    <tr key={q.symbol}>
                      <td>
                        <Link to={`/trade/${q.symbol}`} className="sym">
                          <AssetBadge symbol={q.symbol} assetClass={q.assetClass} />
                          <span className="sym-name">
                            <b>{q.symbol}</b>
                            <span>{q.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="num mono">{price(q.price)}</td>
                      <td className="num mono up">{pct(q.change24h)}</td>
                    </tr>
                  ))}
                  {!overview && (
                    <tr>
                      <td colSpan={3}>
                        <div className="skeleton" style={{ height: 90 }} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Weakest · 24h</h3>
              <Link to="/ai" className="tiny muted">
                AI screen
              </Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {(overview?.losers ?? []).map((q) => (
                    <tr key={q.symbol}>
                      <td>
                        <Link to={`/trade/${q.symbol}`} className="sym">
                          <AssetBadge symbol={q.symbol} assetClass={q.assetClass} />
                          <span className="sym-name">
                            <b>{q.symbol}</b>
                            <span>{q.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="num mono">{price(q.price)}</td>
                      <td className="num mono down">{pct(q.change24h)}</td>
                    </tr>
                  ))}
                  {!overview && (
                    <tr>
                      <td colSpan={3}>
                        <div className="skeleton" style={{ height: 90 }} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Copy the book, not the pitch</h2>
            <p>
              Sixteen strategy desks with live positions, sized allocation and automatic mirroring.
              Follow one, several, or none — you keep full control of risk.
            </p>
          </div>
          <Link to="/copy" className="btn short">
            Copy trading <ArrowIcon />
          </Link>
        </div>
        <div className="grid-3">
          {(traders?.traders ?? []).slice(0, 3).map((t) => (
            <div className="panel" key={t.id} style={{ padding: 18 }}>
              <div className="row between" style={{ marginBottom: 14 }}>
                <div className="row" style={{ gap: 10 }}>
                  <TraderAvatar name={t.name} hue={t.hue} size={38} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                    <div className="tiny muted">@{t.handle}</div>
                  </div>
                </div>
                <RiskBars score={t.riskScore} />
              </div>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span className="tiny muted">30d return</span>
                <span className={`mono ${signClass(t.roi30d)}`} style={{ fontSize: 18 }}>
                  {pct(t.roi30d)}
                </span>
              </div>
              <div className="row between tiny muted" style={{ marginBottom: 14 }}>
                <span>{t.strategy}</span>
                <span className="mono">{t.winRate}% win</span>
              </div>
              <div className="book" style={{ marginBottom: 14 }}>
                {t.openPositions.slice(0, 3).map((p) => (
                  <span className="book-chip" key={`${p.symbol}-${p.openedAt}`}>
                    {p.side === 'long' ? '▲' : '▼'} {p.symbol}{' '}
                    <span className={signClass(p.returnPct)}>{pct(p.returnPct, 1)}</span>
                  </span>
                ))}
                {t.openPositions.length === 0 && (
                  <span className="book-chip">flat · waiting for setup</span>
                )}
              </div>
              <Link
                to="/copy"
                className="btn block short"
                style={{ justifyContent: 'space-between' }}
              >
                <span>{compactMoney(t.aum)} AUM · {t.followers.toLocaleString()} copiers</span>
                <ArrowIcon />
              </Link>
            </div>
          ))}
          {!traders &&
            [0, 1, 2].map((i) => (
              <div className="panel" key={i} style={{ padding: 18 }}>
                <div className="skeleton" style={{ height: 150 }} />
              </div>
            ))}
        </div>
      </section>

      <section className="section">
        <div className="panel" style={{ padding: '32px' }}>
          <div className="grid-2" style={{ alignItems: 'center' }}>
            <div>
              <span className="eyebrow">
                <BoltIcon size={12} /> Platform token · COOL
              </span>
              <h2 style={{ margin: '8px 0 10px', fontSize: 27, letterSpacing: '-0.035em' }}>
                Sum Cool pays you to hold it.
              </h2>
              <p className="muted small" style={{ lineHeight: 1.7, margin: 0 }}>
                Every account can claim 500 COOL once. Fees start at just 0.005%, then drop 25%,
                50% and all the way to zero as your balance crosses each tier. COOL trades like any
                other market on the board.
              </p>
              <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>
                <Link to="/sumcool" className="btn primary short">
                  Claim free COOL <ArrowIcon />
                </Link>
                <span className="tag">0.005% base fee</span>
                <span className="tag">0% at 5,000 COOL</span>
              </div>
            </div>
            <div className="grid-2">
              <div className="metric">
                <span>COOL price</span>
                <b>{cool ? `$${cool.price.toFixed(4)}` : '—'}</b>
                <small>{cool ? `${pct(cool.change24h)} · 24h` : 'loading'}</small>
              </div>
              <div className="metric">
                <span>Market cap</span>
                <b>{cool ? compactMoney(cool.marketCap) : '—'}</b>
                <small>{cool ? `${cool.holders} holders` : 'loading'}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="panel" style={{ padding: '40px 32px' }}>
          <div className="grid-3" style={{ alignItems: 'start' }}>
            <div>
              <span className="eyebrow">
                <ChartIcon size={12} /> How it works
              </span>
              <h2 style={{ margin: 0, fontSize: 28, letterSpacing: '-0.035em' }}>
                From scan to position in three moves.
              </h2>
              <p className="muted small" style={{ lineHeight: 1.65, marginTop: 10 }}>
                Start with $100,000 of paper capital. Nothing here can touch real money — the
                point is to build and test a process.
              </p>
            </div>
            {[
              {
                n: '01',
                t: 'Scan the AI desk',
                d: 'Every market is scored across five models. Sort by conviction, read the reasoning, and open the ones that fit your risk.',
              },
              {
                n: '02',
                t: 'Size and send the order',
                d: 'Pick margin and leverage, attach a stop and target, and see fees, liquidation and position size before you confirm.',
              },
              {
                n: '03',
                t: 'Copy or compound',
                d: 'Allocate to strategy desks and let new entries mirror automatically, or run your own book and track the equity curve.',
              },
            ].map((step) => (
              <div key={step.n}>
                <div className="mono small" style={{ color: 'var(--accent)', marginBottom: 10 }}>
                  {step.n}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{step.t}</h3>
                <p className="muted small" style={{ lineHeight: 1.7, margin: 0 }}>
                  {step.d}
                </p>
              </div>
            ))}
          </div>
          <div className="row between mt-8 wrap" style={{ gap: 16 }}>
            <p className="muted small" style={{ margin: 0 }}>
              {user ? 'Your terminal is ready.' : 'No card, no deposit, no real orders.'}
            </p>
            <button className="btn primary" onClick={onStart}>
              {user ? 'Open terminal' : 'Create your terminal'} <ArrowIcon />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
