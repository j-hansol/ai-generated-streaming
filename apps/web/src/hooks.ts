import { useCallback, useEffect, useRef, useState } from 'react';

/** intervalMs 간격으로 load를 다시 호출한다. reload()로 즉시 갱신할 수 있다. */
export function usePolling<T>(load: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(reload, intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs]);

  return { data, error, reload };
}

/** 현재 시각 (지연 시간 비교용, 기본 100ms마다 갱신) */
export function useClock(intervalMs = 100) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** HH:MM:SS.mmm (테스트 화면의 시계와 같은 형식) */
export const formatClock = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
