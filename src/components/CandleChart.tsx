import { useMemo, useState, type MouseEvent } from 'react';
import type { Candle } from '../lib/types';
import { price, timeShort } from '../lib/format';

interface Props {
  candles: Candle[];
  height?: number;
  loading?: boolean;
}

const W = 900;
const PAD_RIGHT = 58;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

export function CandleChart({ candles, height = 360, loading }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    if (!candles.length) return null;
    const highs = Math.max(...candles.map((c) => c.h));
    const lows = Math.min(...candles.map((c) => c.l));
    const pad = (highs - lows) * 0.08 || highs * 0.01;
    const min = lows - pad;
    const max = highs + pad;
    const plotW = W - PAD_RIGHT;
    const plotH = height - PAD_TOP - PAD_BOTTOM;
    const step = plotW / candles.length;
    const y = (v: number) => PAD_TOP + ((max - v) / (max - min || 1)) * plotH;
    const lines = Array.from({ length: 5 }, (_, i) => {
      const v = min + ((max - min) * i) / 4;
      return { y: y(v), v };
    });
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const idx = Math.min(candles.length - 1, Math.round((i / 4) * (candles.length - 1)));
      return { x: idx * step + step / 2, t: candles[idx].t };
    });
    return { min, max, step, y, x: (i: number) => i * step + step / 2, lines, ticks, plotH };
  }, [candles, height]);

  if (!view || !candles.length) {
    return (
      <div
        style={{
          height,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--muted-2)',
          fontSize: 13,
        }}
      >
        {loading ? 'Loading chart…' : 'No chart data'}
      </div>
    );
  }

  const active = hover != null ? candles[hover] : null;
  const bodyW = Math.max(1, Math.min(9, view.step * 0.62));

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.floor(relX / view.step);
    if (idx >= 0 && idx < candles.length) setHover(idx);
  };

  return (
    <div style={{ position: 'relative' }}>
      {active && (
        <div
          className="row mono small"
          style={{
            position: 'absolute',
            top: 0,
            left: 10,
            gap: 12,
            zIndex: 2,
            color: 'var(--muted)',
            pointerEvents: 'none',
            background: 'rgba(8,10,12,0.72)',
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 11,
          }}
        >
          <span>{new Date(active.t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          <span>O {price(active.o)}</span>
          <span>H {price(active.h)}</span>
          <span>L {price(active.l)}</span>
          <span className={active.c >= active.o ? 'up' : 'down'}>C {price(active.c)}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="chart-svg"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {view.lines.map((line, i) => (
          <g key={i}>
            <line
              x1={0}
              x2={W - PAD_RIGHT}
              y1={line.y}
              y2={line.y}
              stroke="rgba(255,255,255,0.055)"
              strokeWidth={1}
            />
            <text
              x={W - PAD_RIGHT + 8}
              y={line.y + 3.5}
              fill="var(--muted-2)"
              fontSize={10}
              fontFamily="var(--mono)"
            >
              {price(line.v)}
            </text>
          </g>
        ))}
        {view.ticks.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={height - 6}
            fill="var(--muted-2)"
            fontSize={10}
            fontFamily="var(--mono)"
            textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
          >
            {timeShort(tick.t)}
          </text>
        ))}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const color = up ? '#3ee08b' : '#ff5f6d';
          const x = view.x(i);
          const yO = view.y(c.o);
          const yC = view.y(c.c);
          const top = Math.min(yO, yC);
          const h = Math.max(1, Math.abs(yC - yO));
          return (
            <g key={i} opacity={hover == null || hover === i ? 1 : 0.78}>
              <line
                x1={x}
                x2={x}
                y1={view.y(c.h)}
                y2={view.y(c.l)}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={x - bodyW / 2}
                y={top}
                width={bodyW}
                height={h}
                fill={color}
                opacity={up ? 0.9 : 0.95}
                rx={0.6}
              />
            </g>
          );
        })}
        {hover != null && (
          <>
            <line
              x1={view.x(hover)}
              x2={view.x(hover)}
              y1={PAD_TOP}
              y2={height - PAD_BOTTOM}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="3 3"
            />
            <line
              x1={0}
              x2={W - PAD_RIGHT}
              y1={view.y(candles[hover].c)}
              y2={view.y(candles[hover].c)}
              stroke="rgba(255,255,255,0.16)"
              strokeDasharray="3 3"
            />
          </>
        )}
        <line
          x1={0}
          x2={W - PAD_RIGHT}
          y1={view.y(candles[candles.length - 1].c)}
          y2={view.y(candles[candles.length - 1].c)}
          stroke="rgba(184,255,61,0.45)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      </svg>
    </div>
  );
}
