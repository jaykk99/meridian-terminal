import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Link } from '../lib/router';
import type { CopySubscription, Me, Position, Trader } from '../lib/types';
import { compactMoney, money, pct, price, signClass, timeAgo } from '../lib/format';
import { Modal, RiskBars, TraderAvatar } from '../components/ui';
import { CopyIcon } from '../components/Icons';

export function CopyTrading({
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
  const [traders, setTraders] = useState<Trader[]>([]);
  const [mine, setMine] = useState<{
    subscriptions: CopySubscription[];
    copies: Position[];
    equity: number;
    freeCash: number;
  } | null>(null);
  const [selected, setSelected] = useState<Trader | null>(null);
  const [allocation, setAllocation] = useState('5000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');

  const loadTraders = () =>
    api
      .traders()
      .then((res) => setTraders(res.traders))
      .catch(() => undefined);

  const loadMine = () => {
    if (!user) {
      setMine(null);
      return;
    }
    api
      .myCopies()
      .then(setMine)
      .catch(() => undefined);
  };

  useEffect(() => {
    void loadTraders();
    const timer = window.setInterval(loadTraders, 25_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadMine();
    if (!user) return;
    const timer = window.setInterval(loadMine, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const freeCash = mine?.freeCash ?? user?.balance ?? 0;
  const classes = Array.from(new Set(traders.flatMap((t) => t.universe)));

  const openCopy = (trader: Trader) => {
    if (!user) {
      requireAuth('Sign in to allocate capital to a strategy desk.');
      return;
    }
    if (trader.copying) {
      notify(`You already copy ${trader.name}.`, 'error');
      return;
    }
    setSelected(trader);
    setAllocation(String(Math.max(500, Math.floor(freeCash * 0.2))));
    setError(null);
  };

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const amount = Number(allocation);
      if (!Number.isFinite(amount) || amount < 100) throw new Error('Minimum allocation is $100.');
      if (amount > freeCash) throw new Error('Allocation exceeds your free cash.');
      await api.startCopy(selected.id, amount);
      await Promise.all([loadTraders(), Promise.resolve(loadMine())]);
      refreshUser();
      notify(`Copying ${selected.name} with ${money(amount)}`, 'success');
      setSelected(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stop = async (sub: CopySubscription) => {
    setBusy(true);
    try {
      await api.stopCopy(sub.id);
      await Promise.all([loadMine(), loadTraders()]);
      refreshUser();
      notify('Copy stopped · mirrored positions closed', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not stop copy.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const rows = traders.filter((t) => filter === 'All' || t.universe.includes(filter));

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Copy trading</span>
          <h1>Follow the book, not the pitch</h1>
          <p>
            Allocate capital to a strategy desk. New entries are mirrored into your account with
            proportional sizing; you can stop any time and the mirrored book closes with it.
          </p>
        </div>
        <div className="row small muted mono" style={{ gap: 14 }}>
          <span>{traders.length} desks</span>
          <span>{traders.reduce((n, t) => n + t.followers, 0).toLocaleString()} copiers</span>
        </div>
      </div>

      {mine && mine.subscriptions.length > 0 && (
        <div className="mb-4">
          <div className="row between mb-4">
            <h2 style={{ margin: 0, fontSize: 18, letterSpacing: '-0.02em' }}>Your active copies</h2>
            <span className="tiny muted mono">
              {money(mine.freeCash)} free · {money(mine.equity)} equity
            </span>
          </div>
          <div className="grid-2">
            {mine.subscriptions.map((sub) => (
              <div className="panel" key={sub.id} style={{ padding: 18 }}>
                <div className="row between" style={{ marginBottom: 12 }}>
                  <div className="row" style={{ gap: 10 }}>
                    {sub.trader && <TraderAvatar name={sub.trader.name} hue={sub.trader.hue} />}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {sub.trader?.name ?? 'Desk'}
                      </div>
                      <div className="tiny muted">
                        {sub.trader?.strategy} · {sub.trader?.leverage}x · started{' '}
                        {timeAgo(sub.startedAt)}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn danger short"
                    disabled={busy}
                    onClick={() => void stop(sub)}
                  >
                    Stop
                  </button>
                </div>
                <div className="row between wrap" style={{ gap: 12 }}>
                  <div>
                    <div className="tiny muted">Allocation</div>
                    <div className="mono" style={{ fontSize: 16 }}>
                      {money(sub.allocation)}
                    </div>
                  </div>
                  <div>
                    <div className="tiny muted">Mirrored</div>
                    <div className="mono" style={{ fontSize: 16 }}>
                      {sub.mirroredOpen} open / {sub.mirroredClosed} closed
                    </div>
                  </div>
                  <div>
                    <div className="tiny muted">Realised</div>
                    <div className={`mono ${signClass(sub.mirroredPnl)}`} style={{ fontSize: 16 }}>
                      {money(sub.mirroredPnl)}
                    </div>
                  </div>
                </div>
                {mine.copies.filter((c) => c.trader_id === sub.trader?.id).length > 0 && (
                  <div className="book" style={{ marginTop: 12 }}>
                    {mine.copies
                      .filter((c) => c.trader_id === sub.trader?.id)
                      .map((p) => (
                        <span className="book-chip" key={p.id}>
                          {p.side === 'long' ? '▲' : '▼'} {p.symbol}{' '}
                          <span className={signClass(p.roe)}>{pct(p.roe, 1)}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="toolbar">
          <div className="chips">
            <button className={filter === 'All' ? 'active' : ''} onClick={() => setFilter('All')}>
              All desks
            </button>
            {classes.map((c) => (
              <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <span className="row tiny muted" style={{ gap: 6 }}>
            <CopyIcon size={12} /> auto-mirror · max 4 concurrent per desk
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Trader</th>
                <th>Strategy</th>
                <th className="num">30d</th>
                <th className="num">Win</th>
                <th className="num">Followers</th>
                <th className="num">AUM</th>
                <th>Live book</th>
                <th>Risk</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={t.id}>
                  <td className="mono tiny muted">{i + 1}</td>
                  <td>
                    <div className="trader-cell">
                      <TraderAvatar name={t.name} hue={t.hue} />
                      <div className="sym-name">
                        <b>{t.name}</b>
                        <span>@{t.handle}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="sym-name">
                      <b style={{ fontWeight: 500 }}>{t.strategy}</b>
                      <span>{t.universe.join(' · ')}</span>
                    </div>
                  </td>
                  <td className={`num mono ${signClass(t.roi30d)}`}>{pct(t.roi30d, 1)}</td>
                  <td className="num mono">{t.winRate}%</td>
                  <td className="num mono">{t.followers.toLocaleString()}</td>
                  <td className="num mono">{compactMoney(t.aum)}</td>
                  <td>
                    <div className="book">
                      {t.openPositions.slice(0, 2).map((p) => (
                        <span className="book-chip" key={`${p.symbol}${p.openedAt}`}>
                          {p.side === 'long' ? '▲' : '▼'} {p.symbol}{' '}
                          <span className={signClass(p.returnPct)}>{pct(p.returnPct, 1)}</span>
                        </span>
                      ))}
                      {t.openPositions.length === 0 && (
                        <span className="book-chip">flat</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <RiskBars score={t.riskScore} />
                  </td>
                  <td className="num">
                    <button
                      className={`btn short ${t.copying ? 'ghost' : ''}`}
                      onClick={() => openCopy(t)}
                      disabled={t.copying}
                    >
                      {t.copying ? 'Copying' : 'Copy'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty">
                      <b>No desks in that universe</b>
                      <p>Try another asset class filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2 mt-4">
        <div className="panel" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>How mirroring works</h3>
          <ul className="rationale" style={{ gap: 6 }}>
            <li>
              Each desk trades on a fixed cadence. When it opens, your account opens the same market
              and side, sized from your allocation.
            </li>
            <li>
              Positions carry the desk's leverage and close when the desk's holding window expires —
              or when you stop the copy.
            </li>
            <li>
              Your money stays yours: every mirrored fill is isolated margin inside your own
              balance, with no transfer to the trader.
            </li>
          </ul>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Risk disclosures</h3>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Track records are modelled from each desk's simulated book, not audited performance.
            Past performance never predicts future results. Copying a leveraged strategy can lose
            the entire allocated margin quickly — read the risk score and the live book before you
            allocate.
          </p>
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Copy ${selected.name}` : 'Copy trader'}
        subtitle={
          selected
            ? `${selected.strategy} · ${selected.universe.join(', ')} · ${selected.leverage}x · 30d ${pct(
                selected.roi30d,
                1,
              )}`
            : undefined
        }
      >
        {selected && (
          <div className="stack mt-6">
            <div className="grid-2" style={{ gap: 8 }}>
              <div className="level">
                <span>Win rate</span>
                <b>{selected.winRate}%</b>
              </div>
              <div className="level">
                <span>Avg hold</span>
                <b>{selected.avgHoldHours}h</b>
              </div>
              <div className="level">
                <span>Trades / 30d</span>
                <b>{selected.traded30d}</b>
              </div>
              <div className="level">
                <span>Risk</span>
                <b>{selected.risk}</b>
              </div>
            </div>

            <div className="field mt-4">
              <label>Allocation (USD)</label>
              <div className="input-group">
                <input
                  className="input mono"
                  value={allocation}
                  inputMode="decimal"
                  onChange={(e) => setAllocation(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <span className="suffix">USD</span>
              </div>
              <div className="quick">
                {[0.1, 0.25, 0.5, 1].map((f) => (
                  <button
                    key={f}
                    onClick={() =>
                      setAllocation(String(Math.max(100, Math.floor(freeCash * f))))
                    }
                  >
                    {f === 1 ? 'Max' : `${f * 100}%`}
                  </button>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 6 }}>
                Free cash {money(freeCash)} · ~{money((Number(allocation) || 0) * 0.25)} margin per
                mirrored entry · max 4 open.
              </p>
            </div>

            {error && <div className="notice">{error}</div>}

            <button className="btn primary block" disabled={busy} onClick={() => void confirm()}>
              {busy ? <span className="spin" /> : null} Start copying
            </button>
            <p className="tiny muted" style={{ margin: 0 }}>
              You can stop at any time. Stopping closes the mirrored positions at the current
              simulated price.
            </p>
          </div>
        )}
      </Modal>

      <p className="disclaimer">
        Copy-trading performance is simulated and modelled. No strategy desk manages real client
        capital, and nothing on this page is investment advice.
      </p>
    </div>
  );
}
