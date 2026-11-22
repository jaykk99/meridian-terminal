interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function LogoMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 18.5 8.4 8l4.6 6.4L18.6 5"
        stroke="#b8ff3d"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.6" cy="5" r="1.8" fill="#b8ff3d" />
    </svg>
  );
}

export function SparkIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

export function ChartIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M3 3v18h18" />
      <path d="m7 14 3.5-4.5L14 13l4-6" />
    </svg>
  );
}

export function GlobeIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3C9.5 5.5 9.5 18.5 12 21" />
    </svg>
  );
}

export function CopyIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3H5.5A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
    </svg>
  );
}

export function ShieldIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function BoltIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8Z" />
    </svg>
  );
}

export function SearchIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function StarIcon({ size = 14, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} fill={filled ? 'currentColor' : 'none'} aria-hidden>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    </svg>
  );
}

export function ArrowIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function WalletIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v2h-2.5a2.5 2.5 0 0 0 0 5H20v5a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-11Zm12 3H21v3h-5a1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}

export function QrIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.4" />
      <rect x="14" y="3" width="7" height="7" rx="1.4" />
      <rect x="3" y="14" width="7" height="7" rx="1.4" />
      <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 20h3v1" />
    </svg>
  );
}

export function GithubIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}

export function XIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function LogoutIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
    </svg>
  );
}

export function ArrowUpRight({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

export function LayersIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}
