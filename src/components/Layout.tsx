import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, usePathname } from '../lib/router';
import { useQuotes } from '../lib/hooks';
import type { Me } from '../lib/types';
import { money, pct, shortAddress, signClass } from '../lib/format';
import { LogoMark, LogoutIcon, WalletIcon } from './Icons';

const NAV = [
  { to: '/markets', label: 'Markets' },
  { to: '/ai', label: 'AI desk' },
  { to: '/copy', label: 'Copy trading' },
  { to: '/sumcool', label: 'Sum Cool' },
  { to: '/portfolio', label: 'Portfolio' },
];

const TICKER_SYMBOLS = [
  'BTCUSD',
  'ETHUSD',
  'SOLUSD',
  'SPX',
  'NDX',
  'NVDA',
  'AAPL',
  'TSLA',
  'EURUSD',
  'XAUUSD',
  'WTI',
  'COPPER',
  'COOLUSD',
];

function TickerStrip() {
  const { quotes } = useQuotes(TICKER_SYMBOLS, 5000);
  const items = TICKER_SYMBOLS.map((s) => quotes[s]).filter(Boolean);
  if (!items.length) {
    return <div className="ticker" />;
  }
  const doubled = [...items, ...items];
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">
        {doubled.map((q, i) => (
          <span className="tick" key={`${q.symbol}-${i}`}>
            <b>{q.symbol}</b>
            {q.price.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: q.price < 10 ? 4 : 2,
            })}
            <span className={signClass(q.change24h)}>{pct(q.change24h)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Layout({
  children,
  user,
  onSignIn,
  onSignOut,
}: {
  children: ReactNode;
  user: Me | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenu(false);
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <LogoMark size={16} />
            </span>
            Meridian
            <em>Terminal</em>
          </Link>
          <nav className="nav">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={path.startsWith(item.to) ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="spacer" />
          <span className="pill dot" style={{ display: 'flex' }}>
            Paper
          </span>
          {user ? (
            <div className="row" ref={menuRef} style={{ position: 'relative', gap: 8 }}>
              <Link
                to="/portfolio"
                className="pill mono"
                style={{ color: 'var(--text)', borderColor: 'var(--line-strong)' }}
                title="Free cash"
              >
                {money(user.balance, 0)}
              </Link>
              <button
                className="star"
                onClick={() => setMenu((v) => !v)}
                aria-label="Account menu"
                style={{ lineHeight: 0 }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    width={30}
                    height={30}
                    style={{ borderRadius: '50%', border: '1px solid var(--line-strong)' }}
                  />
                ) : (
                  <span
                    className="avatar"
                    style={{
                      width: 30,
                      height: 30,
                      fontSize: 11,
                      background:
                        user.provider === 'wallet'
                          ? 'rgba(51,117,187,0.22)'
                          : 'rgba(184,255,61,0.12)',
                      color: user.provider === 'wallet' ? '#8fc5f5' : 'var(--accent)',
                    }}
                  >
                    {user.provider === 'wallet' ? (
                      <WalletIcon size={15} />
                    ) : (
                      (user.name ?? 'G').slice(0, 2).toUpperCase()
                    )}
                  </span>
                )}
              </button>
              {menu && (
                <div
                  className="panel"
                  style={{
                    position: 'absolute',
                    top: 40,
                    right: 0,
                    minWidth: 220,
                    zIndex: 60,
                    padding: 6,
                  }}
                >
                  <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 13, fontWeight: 550 }}>{user.name ?? user.login}</div>
                    <div className="tiny muted mono">
                      {user.provider === 'wallet'
                        ? `Trust Wallet · ${shortAddress(user.walletAddress ?? '')}`
                        : user.isGuest
                          ? 'Guest session'
                          : `@${user.login}`}
                    </div>
                  </div>
                  <Link
                    to="/portfolio"
                    className="btn ghost block"
                    style={{ border: 'none', justifyContent: 'flex-start', marginTop: 4 }}
                  >
                    Portfolio
                  </Link>
                  <button
                    className="btn ghost block"
                    style={{ border: 'none', justifyContent: 'flex-start' }}
                    onClick={onSignOut}
                  >
                    <LogoutIcon size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="btn ghost short" onClick={onSignIn}>
                Sign in
              </button>
              <button className="btn primary short" onClick={onSignIn}>
                Start trading
              </button>
            </>
          )}
        </div>
      </header>
      <TickerStrip />
      <main className="main">{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="brand-mark" style={{ width: 22, height: 22 }}>
              <LogoMark size={13} />
            </span>
            <b style={{ color: 'var(--text)', fontWeight: 600 }}>Meridian</b>
          </div>
          <p>
            An AI-native trading terminal for crypto, equities, forex, indices, commodities and
            ETFs. Built for practice, research and strategy testing.
          </p>
          <p className="disclaimer">
            Meridian is a simulation. Prices are synthetic, orders never reach a real venue, and
            nothing here is investment advice. Copy-trading results are modelled, not audited
            performance. Trading with leverage can lose more than you deposit in real markets.
          </p>
        </div>
        <div className="row wrap" style={{ alignItems: 'flex-start', gap: 22 }}>
          <div className="stack" style={{ gap: 8 }}>
            <span className="tiny" style={{ color: 'var(--muted-2)' }}>
              Terminal
            </span>
            <Link to="/markets">Markets</Link>
            <Link to="/ai">AI desk</Link>
            <Link to="/copy">Copy trading</Link>
            <Link to="/sumcool">Sum Cool</Link>
            <Link to="/portfolio">Portfolio</Link>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="tiny" style={{ color: 'var(--muted-2)' }}>
              Status
            </span>
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
              Simulated feed live
            </span>
            <span className="mono tiny">v1.0 · paper</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Toast({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  return <div className={`toast ${kind}`}>{message}</div>;
}
