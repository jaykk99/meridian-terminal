import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { Quote } from './types';

/** Poll a fixed set of live quotes. */
export function useQuotes(symbols: string[] | null, refreshMs = 4000) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [at, setAt] = useState(0);
  const key = symbols ? symbols.join(',') : 'all';
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await api.quotes(symbols ?? undefined);
        if (!mounted.current) return;
        const map: Record<string, Quote> = {};
        for (const q of res.quotes) map[q.symbol] = q;
        setQuotes(map);
        setAt(res.at);
      } catch {
        /* transient network error — next tick retries */
      }
      if (mounted.current) timer = window.setTimeout(load, refreshMs);
    };
    void load();
    return () => {
      mounted.current = false;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs]);

  return { quotes, at };
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const run = useCallback(() => {
    setLoading(true);
    fn()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return { data, error, loading, reload: () => setTick((n) => n + 1) };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
