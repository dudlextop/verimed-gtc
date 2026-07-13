"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useApi<T>(loader: () => Promise<T>, requestKey: unknown = "default", enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const loaderRef = useRef(loader);
  const requestSequence = useRef(0);
  useEffect(() => { loaderRef.current = loader; }, [loader]);
  const stableRequestKey = JSON.stringify(requestKey);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const value = await loaderRef.current();
      if (sequence === requestSequence.current) setData(value);
    } catch (cause) {
      if (sequence === requestSequence.current) {
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить данные");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!enabled) {
      requestSequence.current += 1;
      return;
    }
    let active = true;
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; requestSequence.current += 1; };
  }, [enabled, load, stableRequestKey]);
  return { data, error, loading, retry: load, setData };
}
