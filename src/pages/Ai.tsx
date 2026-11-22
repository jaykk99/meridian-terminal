import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { Brief, Signal } from '../lib/types';
import { pct, price, signClass } from '../lib/format';
import { ScoreChip } from '../components/ui';
import { ArrowIcon, BoltIcon, SparkIcon } from '../components/Icons';

export function AiDesk() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [at, setAt] = useState(0);
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .scanner()
        .then((res) => {
          if (!alive) return;
          setSignals(res.signals);
          setBrief(res.brief);
          setAt(res.at);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 45_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const classes = Array.from(new Set(signals.map((s) => s.assetClass)));
  const filtered = signals.filter((s) => filter === 'All' || s.assetClass === filter);
  const visible = expanded ? filtered : filtered.slice(0, 12);
  const bullish = brief?.counts.bullish ?? 0;
  const bearish = brief?.counts.bearish ?? 0;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <SparkIcon size={12} /> AI desk
          </span>
          <h1>Signals with the reasoning attached</h1>
          <p>
            Five models — trend, structure, momentum, RSI and range position — score every market
            each cycle. Each call ships with confidence, a target, an invalidation level and the
            evidence behind it.
          </p>
        </div>
        <div className="tiny muted mono">
          {at ? `refreshed ${new Date(at).toLocaleTimeString('en-US', { hour12: false })}` : 'scanning…'}
        </div>
      </div>

      <div className="brief mb-4">
        <div className="row between wrap" style={{ gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 420px' }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <span className="pill dot">{brief?.regime ?? 'Scanning'}</span>
              <span className="pill">{brief?.volatility ?? '—'} volatility</span>
              <span className="pill mono">avg score {brief?.avgScore?.toFixed(2) ?? '—'}</span>
            </div>
            <h3>Desk briefing</h3>
            <ul>
              {(brief?.notes ?? ['Building the cross-asset picture…']).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <div style={{ flex: '0 1 320px', minWidth: 260 }}>
            <div className="row between small" style={{ marginBottom: 6 }}>
              <span className="muted">Market breadth</span>
              <span className="mono">{brief?.breadth ?? 50}% bullish</span>
            </div>
            <div className="bar-track" style={{ marginBottom: 12 }}>
              <div
                className="bar-fill"
                style={{
                  width: `${brief?.breadth ?? 50}%`,
                  background: 'linear-gradient(90deg, var(--teal), var(--accent))',
                }}
              />
            </div>
            <div className="row between tiny mono muted">
              <span className="up">{bullish} bullish</span>
              <span>{brief?.counts.neutral ?? 0} neutral</span>
              <span className="down">{bearish} bearish</span>
            </div>
            <div className="row between mt-4 small">
              <span className="muted">Highest conviction</span>
              <span className="mono">
                {brief?.top[0] ? `${brief.top[0].symbol} · ${brief.top[0].confidence}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="chips">
            <button className={filter === 'All' ? 'active' : ''} onClick={() => setFilter('All')}>
              All classes
            </button>
            {classes.map((c) => (
              <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <span className="row tiny muted" style={{ gap: 6 }}>
            <BoltIcon size={12} /> ranked by conviction
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Signal</th>
                <th className="num">Score</th>
                <th className="num">Conf.</th>
                <th className="num">Price</th>
                <th className="num">24h</th>
                <th className="num">RSI</th>
                <th className="num">Target</th>
                <th className="num">Invalidation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.symbol}>
                  <td>
                    <Link to={`/trade/${s.symbol}`} className="sym">
                      <span className="sym-name">
                        <b>{s.symbol}</b>
                        <span>{s.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <ScoreChip score={s.score} label={s.label} />
                  </td>
                  <td className="num mono">{s.score.toFixed(2)}</td>
                  <td className="num mono">{s.confidence}%</td>
                  <td className="num mono">{price(s.price)}</td>
                  <td className={`num mono ${signClass(s.change24h)}`}>{pct(s.change24h)}</td>
                  <td className="num mono muted">{s.rsi}</td>
                  <td className="num mono up">{price(s.target)}</td>
                  <td className="num mono down">{price(s.invalidation)}</td>
                  <td className="num">
                    <Link to={`/trade/${s.symbol}`} className="btn short">
                      Trade
                    </Link>
                  </td>
                </tr>
              ))}
              {!signals.length &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td colSpan={10}>
                      <div className="skeleton" style={{ height: 16 }} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 12 && (
          <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid var(--line)' }}>
            <button className="btn ghost short" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show top 12' : `Show all ${filtered.length} markets`}
            </button>
          </div>
        )}
      </div>

      <div className="grid-2 mt-4">
        <div className="panel" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>The ensemble</h3>
          <div className="stack" style={{ gap: 9 }}>
            {[
              ['Trend (36%)', 'EMA 9 vs 21, normalised by ATR so scores compare across asset classes.'],
              ['Structure (20%)', '21 vs 55 EMA — keeps short-term signals honest against the higher timeframe.'],
              ['Momentum (24%)', '24-bar rate of change, scaled to volatility.'],
              ['RSI (12%)', 'Relative strength, with overbought and oversold conditions penalised.'],
              ['Range (8%)', 'Where price sits inside its 24h range — a positioning tiebreaker.'],
            ].map(([name, copy]) => (
              <div key={name}>
                <div className="row between small">
                  <b style={{ fontWeight: 550 }}>{name}</b>
                </div>
                <div className="tiny muted" style={{ lineHeight: 1.55 }}>
                  {copy}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>How to use the desk</h3>
          <ul className="rationale" style={{ gap: 7 }}>
            <li>
              Confidence measures how aligned the models are, not how much you should risk. Size
              from volatility and stop distance.
            </li>
            <li>
              Treat the invalidation level as part of the trade: if it breaks, the thesis is wrong.
            </li>
            <li>
              Signals refresh every 45 seconds on simulated prices. They are research output, not
              advice, and no model is right every time.
            </li>
          </ul>
          <div className="row mt-4">
            <Link to="/markets" className="btn short">
              Open the market board <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>

      <p className="disclaimer">
        AI output is generated from a deterministic technical ensemble over simulated prices. It is
        not personalised advice and does not account for your circumstances.
      </p>
    </div>
  );
}
