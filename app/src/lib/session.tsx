import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, loadToken, saveToken, setUnauthorizedHandler, type Profile } from './api';

type Ctx = {
  ready: boolean;
  profile: Profile | null;
  signIn: (token: string, p: Profile) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  memberName: (id: string | null | undefined) => string;
  memberColor: (id: string | null | undefined) => string;
};

const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const signOut = useCallback(async () => {
    api('/api/logout', { method: 'POST' }).catch(() => undefined);
    await saveToken(null);
    setProfile(null);
  }, []);

  const refresh = useCallback(async () => {
    const p = await api<Profile>('/api/me');
    setProfile(p);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { saveToken(null); setProfile(null); });
    (async () => {
      const t = await loadToken();
      if (t) {
        try { await refresh(); } catch { /* offline or expired: login screen or retry later */ }
      }
      setReady(true);
    })();
  }, [refresh]);

  const signIn = useCallback(async (token: string, p: Profile) => {
    await saveToken(token);
    setProfile(p);
  }, []);

  const memberName = useCallback((id: string | null | undefined) => {
    if (!id) return 'Either';
    if (id === 'both') return 'Both';
    return profile?.members.find((m) => m.id === id)?.name ?? 'Someone';
  }, [profile]);

  const memberColor = useCallback((id: string | null | undefined) => {
    return profile?.members.find((m) => m.id === id)?.color ?? '#6B6F6C';
  }, [profile]);

  return (
    <SessionCtx.Provider value={{ ready, profile, signIn, signOut, refresh, memberName, memberColor }}>
      {children}
    </SessionCtx.Provider>
  );
}
