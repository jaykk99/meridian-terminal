interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  responsive?: boolean;
}

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = '#3ee08b',
  fill = false,
  strokeWidth = 1.5,
  responsive = false,
}: Props) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => [i * stepX, height - 2 - ((v - min) / span) * (height - 4)]);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const id = `sp-${Math.round(points[0][1] * 100)}-${data.length}-${Math.round(max * 100)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={responsive ? 'none' : undefined}
      style={responsive ? { width: '100%', height } : undefined}
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${width},${height} L0,${height} Z`}
            fill={`url(#${id})`}
            stroke="none"
          />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  );
}
