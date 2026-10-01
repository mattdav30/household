import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL: string = (Constants.expoConfig?.extra as { apiUrl?: string })?.apiUrl ?? '';
const TOKEN_KEY = 'household_token';

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
    throw new ApiError(data.error ?? 'Something went wrong.', res.status);
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
  user: { id: string; household_id: string; email: string; name: string; color: string };
  household: { id: string; name: string; invite_code: string };
  members: Member[];
};

export type ShoppingItem = { id: string; name: string; qty: string | null; aisle: string; checked: number; added_by: string | null; created_at: number };
export type Recipe = { id: string; title: string; ingredients: string; url: string | null; notes: string | null };
export type Meal = { id: string; date: string; slot: string; title: string; recipe_id: string | null; notes: string | null };
export type Chore = { id: string; title: string; assignee_id: string | null; due_date: string | null; repeat: string; done_at: number | null; notes: string | null };
export type CalEvent = { id: string; title: string; date: string; start_time: string | null; end_time: string | null; who: string; location: string | null; notes: string | null };
export type Bill = { id: string; name: string; amount_cents: number | null; due_date: string; repeat: string; last_paid_at: number | null; notes: string | null };
export type Wish = { id: string; list: string; title: string; url: string | null; price_cents: number | null; for_whom: string | null; added_by: string | null; status: string; notes: string | null };
