import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, loadToken, type Summary } from '../lib/api';
import type { WidgetData } from './JourneyWidget';

const CACHE = 'rtt_widget_cache';
const MOOD: Record<string, string> = { new: 'is excited to meet you', thrilled: 'is over the moon', happy: 'is happy', okay: 'is doing okay', sad: 'misses your walks' };

export async function loadWidgetData(): Promise<{ data: WidgetData | null; message?: string }> {
  const token = await loadToken();
  if (!token) return { data: null, message: 'Open Road to Tokyo and sign in.' };
  try {
    const s = await api<Summary>('/api/fit/summary');
    const me = s.members.find((m) => m.id === s.me)!;
    const pet = s.pet.name ?? 'Your pet';
    const data: WidgetData = {
      title: `${pet} ${MOOD[s.pet.mood] ?? 'is waiting'}`,
      line: me.today_minutes >= me.target ? `Step done today, ${me.today_minutes} min` : `${me.today_minutes} of ${me.target} min today`,
      bowls: s.members.map((m) => ({ name: m.name, fed: !!s.pet.fed[m.id] })),
      streak: s.streaks[s.me]?.days ?? 0,
      label: s.countdown.days > 0 ? `${s.countdown.days} DAYS TO ${s.countdown.label.toUpperCase()}` : `STEP ${me.step}`,
      pct: Math.min(1, me.today_minutes / Math.max(1, me.target)),
    };
    if (Platform.OS === 'android') await SecureStore.setItemAsync(CACHE, JSON.stringify(data)).catch(() => undefined);
    return { data };
  } catch {
    const cached = await SecureStore.getItemAsync(CACHE).catch(() => null);
    return cached ? { data: JSON.parse(cached) } : { data: null, message: 'Waiting for a connection.' };
  }
}
