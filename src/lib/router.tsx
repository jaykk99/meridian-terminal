import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent,
} from 'react';

export function navigate(to: string) {
  if (window.location.pathname + window.location.search === to) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

export function useLocation(): string {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return path;
}

export function usePathname(): string {
  return useLocation().split('?')[0];
}

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  title?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Link({ to, children, className, title, style, onClick }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={to} className={className} title={title} style={style} onClick={handle}>
      {children}
    </a>
  );
}
