export function money(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function compactMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function compact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function pct(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

export function price(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  let decimals = 2;
  if (abs < 1) decimals = 4;
  if (abs < 0.01) decimals = 7;
  if (abs >= 10_000) decimals = 1;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function signClass(n: number): string {
  return n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function timeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function dateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function feePct(rate: number): string {
  const value = rate * 100;
  if (value === 0) return '0%';
  return `${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function classHue(assetClass: string): number {
  switch (assetClass) {
    case 'Crypto':
      return 78;
    case 'Equities':
      return 212;
    case 'Forex':
      return 188;
    case 'Indices':
      return 268;
    case 'Commodities':
      return 40;
    default:
      return 150;
  }
}
