import { useEffect, type ReactNode } from 'react';
import { XIcon } from './Icons';
import { classHue } from '../lib/format';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="star" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AssetBadge({ symbol, assetClass }: { symbol: string; assetClass: string }) {
  const hue = classHue(assetClass);
  return (
    <div
      className="sym-icon"
      style={{
        background: `hsla(${hue}, 70%, 55%, 0.12)`,
        borderColor: `hsla(${hue}, 70%, 55%, 0.28)`,
        color: `hsl(${hue}, 70%, 68%)`,
      }}
    >
      {symbol.replace('USD', '').slice(0, 4)}
    </div>
  );
}

export function TraderAvatar({
  name,
  hue,
  size = 34,
}: {
  name: string;
  hue: number;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, hsla(${hue}, 80%, 55%, 0.35), hsla(${
          hue + 40
        }, 80%, 45%, 0.12))`,
        color: `hsl(${hue}, 85%, 78%)`,
        fontSize: size * 0.34,
      }}
    >
      {initials}
    </div>
  );
}

export function ScoreChip({ score, label }: { score: number; label: string }) {
  const kind = score > 0.16 ? 'buy' : score < -0.16 ? 'sell' : 'neutral';
  const width = Math.min(46, Math.abs(score) * 46);
  return (
    <span className="score" title={`Ensemble score ${score.toFixed(2)}`}>
      <span className="score-bar">
        <span
          className={`score-fill ${score >= 0 ? 'up' : 'down'}`}
          style={
            score >= 0
              ? { left: '50%', width }
              : { right: '50%', left: 'auto', width }
          }
        />
      </span>
      <span className={`chip ${kind}`}>{label}</span>
    </span>
  );
}

export function RiskBars({ score }: { score: number }) {
  const filled = Math.max(1, Math.min(4, Math.ceil(score / 25)));
  return (
    <span className="risk-bars" title={`Risk score ${score}/100`}>
      {[0, 1, 2, 3].map((i) => (
        <i
          key={i}
          style={
            i < filled
              ? {
                  background:
                    score > 70 ? 'var(--down)' : score > 45 ? 'var(--warn)' : 'var(--up)',
                }
              : undefined
          }
        />
      ))}
    </span>
  );
}

export function LoadingRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <div
                className="skeleton"
                style={{ height: 12, width: c === 0 ? 120 : 64, opacity: 0.6 }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
