import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, changes, type Summary } from './api';
import { useSession } from './session';
import { getWeather, type Weather } from './weather';
import { local } from './local';
import type { Equip } from './exercises';
import type { PlanInput } from './plan';
import { scheduleReminders } from './notify';
import { refreshWidgetSoon } from '../widget/refresh';
import { syncHealth } from './health';

type Ctx = {
  summary: Summary | null;
  error: string | null;
  weather: Weather | null;
  refresh: () => Promise<void>;
  apply: (s: Summary) => void;
  planInput: (overrides?: Partial<PlanInput>) => PlanInput | null;
  name: (id: string | null | undefined) => string;
  color: (id: string | null | undefined) => string;
  partner: Summary['members'][number] | null;
  steps: number | null;
  imported: number;
  clearImported: () => void;
  syncNow: () => Promise<number | null>;
};

const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { profile, memberColor } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [imported, setImported] = useState(0);

  const apply = useCallback((s: Summary) => {
    setSummary(s);
    setError(null);
    scheduleReminders(s).catch(() => undefined);
    refreshWidgetSoon();
  }, []);

  // Pulls in anything Samsung Health recorded, then loads the latest summary.
  const syncNow = useCallback(async () => {
    const r = await syncHealth();
    if (!r) return null;
    if (r.steps != null) setSteps(r.steps);
    if (r.added) setImported(r.added);
    if (r.summary) apply(r.summary);
    return r.added;
  }, [apply]);

  const refresh = useCallback(async () => {
    try { apply(await api<Summary>('/api/fit/summary')); } catch (e) { setError((e as Error).message); }
    syncNow().catch(() => undefined);
  }, [apply, syncNow]);

  useEffect(() => {
    if (!profile) { setSummary(null); return; }
    refresh();
    getWeather().then(setWeather);
    return changes.on(() => { refresh(); });
  }, [profile, refresh]);

  const planInput = useCallback((o: Partial<PlanInput> = {}): PlanInput | null => {
    if (!summary) return null;
    const me = summary.members.find((m) => m.id === summary.me);
    return {
      date: summary.today,
      step: me?.step ?? 1,
      target: me?.target ?? 10,
      equipment: summary.settings.equipment as Equip[],
      quiet: local.quiet(),
      weather,
      shuffle: local.shuffle(summary.today),
      ...o,
    };
  }, [summary, weather]);

  const name = useCallback((id: string | null | undefined) => summary?.members.find((m) => m.id === id)?.name ?? 'Someone', [summary]);
  const partner = useMemo(() => summary?.members.find((m) => m.id !== summary.me) ?? null, [summary]);

  return (
    <StoreCtx.Provider value={{ summary, error, weather, refresh, apply, planInput, name, color: memberColor, partner, steps, imported, clearImported: () => setImported(0), syncNow }}>
      {children}
    </StoreCtx.Provider>
  );
}
