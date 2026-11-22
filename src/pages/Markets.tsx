import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useQuotes } from '../lib/hooks';
import { Link, useLocation } from '../lib/router';
import type { Me, Signal, SymbolMeta } from '../lib/types';
import { dateShort, price, pct, signClass } from '../lib/format';
import { Sparkline } from '../components/Sparkline';
import { AssetBadge, ScoreChip } from '../components/ui';
import { SearchIcon, StarIcon } from '../components/Icons';

type SortKey = 'symbol' | 'price' | 'change24h' | 'score';

export function Markets({
  user,
  requireAuth,
}: {
  user: Me | null;
  requireAuth: (reason?: string) => void;
}) {
  const location = useLocation();
  const initialClass = new URLSearchParams(location.split('?')[1] ?? '').get('class') ?? 'All';
  const [meta, setMeta] = useState<SymbolMeta[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [signals, setSignals] = useState<Record<string, Signal>>({});
  const [watch, setWatch] = useState<string[]>([]);
  const [filter, setFilter] = useState(initialClass);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('score');
  const [dir, setDir] = useState<1 | -1>(-1);

  const { quotes } = useQuotes(null, 4000);

  useEffect(() => {
    api
      .symbols()
      .then((res) => {
        setMeta(res.symbols);
        setClasses(res.classes);
      })
      .catch(() => undefined);
    const loadScan = () =>
      api
        .scanner()
        .then((res) => {
          const map: Record<string, Signal> = {};
          for (const s of res.signals) map[s.symbol] = s;
          setSignals(map);
        })
        .catch(() => undefined);
    void loadScan();
    const timer = window.setInterval(loadScan, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      setWatch([]);
      return;
    }
    api
      .watchlist()
      .then((res) => setWatch(res.symbols))
      .catch(() => undefined);
  }, [user]);

  const toggleWatch = async (symbol: string) => {
    if (!user) {
      requireAuth('Sign in to save markets to your watchlist.');
      return;
    }
    const on = watch.includes(symbol);
    setWatch((prev) => (on ? prev.filter((s) => s !== symbol) : [...prev, symbol]));
    try {
      if (on) await api.removeWatch(symbol);
      else await api.addWatch(symbol);
    } catch {
      setWatch((prev) => (on ? [...prev, symbol] : prev.filter((s) => s !== symbol)));
    }
  };

  const rows = useMemo(() => {
    const list = meta
      .filter((m) => filter === 'All' || m.assetClass === filter)
      .filter((m) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
      })
      .map((m) => {
        const q = quotes[m.symbol];
        const s = signals[m.symbol];
        return { meta: m, quote: q, signal: s };
      });

    const value = (row: (typeof list)[number]): number | string => {
      if (sort === 'symbol') return row.meta.symbol;
      if (sort === 'score') return row.signal ? row.signal.score * row.signal.confidence : -999;
      if (sort === 'change24h') return row.quote?.change24h ?? -999;
      return row.quote?.price ?? 0;
    };

    return list.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * dir;
      }
      return (av - bv) * dir;
    });
  }, [meta, filter, search, quotes, signals, sort, dir]);

  const setSorting = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(key === 'symbol' ? 1 : -1);
    }
  };

  const headerButton = (key: SortKey, label: string, numeric = false) => (
    <th
      className={numeric ? 'num' : ''}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => setSorting(key)}
    >
      {label}
      {sort === key ? (dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  );

  const stamp = dateShort(Date.now());

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Market board</span>
          <h1>Every market, live</h1>
          <p>
            {meta.length || 346} instruments across six asset classes, scored continuously by the
            AI ensemble. Prices are simulated for paper trading and update every few seconds.
          </p>
        </div>
        <div className="row small muted mono" style={{ gap: 14 }}>
          <span>{stamp}</span>
          <span className="row" style={{ gap: 6 }}>
            <i
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--up)',
                display: 'inline-block',
              }}
            />
            streaming
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <SearchIcon />
            <input
              placeholder="Search BTC, Nvidia, EURUSD…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="chips">
            <button className={filter === 'All' ? 'active' : ''} onClick={() => setFilter('All')}>
              All
            </button>
            {classes.map((c) => (
              <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <span className="tiny muted mono">{rows.length} rows</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 34 }} />
                {headerButton('symbol', 'Market')}
                <th>Class</th>
                {headerButton('price', 'Last', true)}
                {headerButton('change24h', '24h', true)}
                <th className="num">24h range</th>
                <th className="num">Trend</th>
                {headerButton('score', 'AI signal')}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const q = row.quote;
                const s = row.signal;
                return (
                  <tr key={row.meta.symbol}>
                    <td>
                      <button
                        className={`star ${watch.includes(row.meta.symbol) ? 'on' : ''}`}
                        onClick={() => void toggleWatch(row.meta.symbol)}
                        aria-label="Watchlist"
                      >
                        <StarIcon filled={watch.includes(row.meta.symbol)} size={13} />
                      </button>
                    </td>
                    <td>
                      <Link to={`/trade/${row.meta.symbol}`} className="sym">
                        <AssetBadge symbol={row.meta.symbol} assetClass={row.meta.assetClass} />
                        <span className="sym-name">
                          <b>{row.meta.symbol}</b>
                          <span>{row.meta.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="tag">{row.meta.assetClass}</span>
                    </td>
                    <td className="num mono">
                      {q ? price(q.price) : <span className="skeleton" style={{ display: 'inline-block', width: 56, height: 12 }} />}
                    </td>
                    <td className={`num mono ${q ? signClass(q.change24h) : ''}`}>
                      {q ? pct(q.change24h) : '—'}
                    </td>
                    <td className="num mono tiny muted">
                      {q ? `${price(q.low24h)} – ${price(q.high24h)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {q?.spark?.length ? (
                        <Sparkline
                          data={q.spark}
                          width={78}
                          height={24}
                          color={q.change24h >= 0 ? '#3ee08b' : '#ff5f6d'}
                        />
                      ) : null}
                    </td>
                    <td>
                      {s ? (
                        <ScoreChip score={s.score} label={s.label} />
                      ) : (
                        <span className="tiny muted">—</span>
                      )}
                    </td>
                    <td className="num">
                      <Link to={`/trade/${row.meta.symbol}`} className="btn short">
                        Trade
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty">
                      <b>No markets match that filter</b>
                      <p>Try a different asset class or clear the search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="disclaimer">
        Prices are generated by a deterministic simulation, not a live exchange feed. 24h change is
        measured against the simulated price 24 hours ago. AI scores are model output, not
        recommendations.
      </p>
    </div>
  );
}
