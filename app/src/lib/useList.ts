import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, changes } from './api';

/**
 * Loads a list from the API, refreshes when the screen gains focus, when the app
 * returns to the foreground, and whenever a change event fires for the table.
 */
export function useList<T>(path: string, table?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    try {
      const rows = await api<T[]>(pathRef.current);
      setData(rows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [path, load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    const off = changes.on((t) => { if (!t || !table || t === table) load(); });
    return () => { sub.remove(); off(); };
  }, [load, table]);

  return { data, setData, loading, error, reload: load };
}

export function useObject<T>(path: string, tables: string[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await api<T>(path)); setError(null); } catch (e) { setError((e as Error).message); }
  }, [path]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    const off = changes.on((t) => { if (!t || tables.includes(t)) load(); });
    return () => { sub.remove(); off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  return { data, error, reload: load };
}
