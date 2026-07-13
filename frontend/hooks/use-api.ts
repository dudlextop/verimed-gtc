"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useApi<T>(loader: () => Promise<T>, requestKey: unknown = "default") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  useEffect(() => { loaderRef.current = loader; }, [loader]);
  const stableRequestKey = JSON.stringify(requestKey);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setData(await loaderRef.current()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось загрузить данные"); } finally { setLoading(false); } }, []);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; }; }, [load, stableRequestKey]);
  return { data, error, loading, retry: load, setData };
}
