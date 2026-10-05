import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL: string = (Constants.expoConfig?.extra as { apiUrl?: string })?.apiUrl ?? '';
const TOKEN_KEY = 'rtt_token';

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

// Phones keep the sign in token in the secure keystore. The web preview uses localStorage.
const web = Platform.OS === 'web';
export async function loadToken() {
  token = web ? globalThis.localStorage?.getItem(TOKEN_KEY) ?? null : await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  if (web) { if (t) globalThis.localStorage?.setItem(TOKEN_KEY, t); else globalThis.localStorage?.removeItem(TOKEN_KEY); return; }
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && path.startsWith('/api/')) onUnauthorized?.();
    throw new ApiError(data.error ?? 'Something went wrong. Pull down to try again.', res.status);
  }
  return data as T;
}

// Tiny change bus: screens subscribe and refetch when another screen or a push says data changed.
type Listener = (table?: string) => void;
const listeners = new Set<Listener>();
export const changes = {
  emit: (table?: string) => listeners.forEach((l) => l(table)),
  on: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export type Member = { id: string; name: string; color: string };
export type Profile = {
  user: { id: string; household_id: string; email: string; name: string; color: string; notify_hour?: number | null };
  household: { id: string; name: string; invite_code: string };
  members: Member[];
};

export type Workout = {
  id: string; user_id: string; group_id: string | null; date: string; minutes: number; kind: string; title: string;
  effort: number; together: number; notes: string | null; created_at: number;
};
export type Stop = {
  index: number; name: string; lat: number; lon: number; note: string; km: number; reached: boolean;
  reward: string | null; claimed_at: number | null;
};
export type Streak = { days: number; done_today: boolean; shields_left: number; last_shield: string | null };
export type FitMember = { id: string; name: string; color: string; level: number; reminder_hour: number | null };
export type Summary = {
  today: string;
  me: string;
  settings: {
    start_date: string; wedding_date: string; weekly_goal_min: number; jar_cents: number; jar_goal_cents: number;
    equipment: string[]; default_stake: string;
  };
  members: FitMember[];
  days_to_wedding: number;
  week_index: number;
  total_weeks: number;
  week: { start: string; goal: number; by_user: Record<string, number>; total: number; days: { date: string; by_user: Record<string, number> }[] };
  streaks: Record<string, Streak>;
  journey: {
    stops: Stop[]; total_km: number; km: number; fraction: number; minutes: number; goal_minutes: number;
    expected_fraction: number; next: number | null; km_per_minute: number;
  };
  challenge: {
    week_start: string; stake: string; by_user: Record<string, number>;
    last: null | { week_start: string; stake: string; by_user: Record<string, number>; meal_id: string | null; winner: string | null; loser: string | null };
  };
  jar: { sessions: number; rate_cents: number; earned_cents: number; banked_cents: number; goal_cents: number };
  recent: Workout[];
};
export type Measurement = {
  id: string; user_id: string; date: string; waist_cm: number | null; hips_cm: number | null; chest_cm: number | null;
  arm_cm: number | null; weight_kg: number | null; created_at: number;
};
export type JarEntry = { id: string; amount_cents: number; note: string | null; date: string; created_at: number };
