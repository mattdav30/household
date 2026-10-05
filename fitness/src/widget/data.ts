import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, loadToken, type Summary } from '../lib/api';
import { todaysSession } from '../lib/plan';
import { local } from '../lib/local';
import type { Equip } from '../lib/exercises';
import type { WidgetData } from './JourneyWidget';

const CACHE = 'rtt_widget_cache';

export async function loadWidgetData(): Promise<{ data: WidgetData | null; message?: string }> {
  const token = await loadToken();
  if (!token) return { data: null, message: 'Open Road to Tokyo and sign in.' };
  try {
    const s = await api<Summary>('/api/fit/summary');
    const me = s.members.find((m) => m.id === s.me);
    const { session } = todaysSession({ date: s.today, week: s.week_index, level: me?.level ?? 1, equipment: s.settings.equipment as Equip[], quiet: local.quiet() });
    const j = s.journey;
    const next = j && !j.complete && j.next != null ? j.stops[j.next] : null;
    const data: WidgetData = {
      session: session.title, minutes: session.minutes, done: !!s.streaks[s.me]?.done_today, streak: s.streaks[s.me]?.days ?? 0,
      week: s.week.total, goal: s.week.goal, next: next?.name ?? null, kmLeft: next && j ? next.km - j.km : 0,
      label: s.countdown.days > 0 ? `${s.countdown.days} DAYS TO ${s.countdown.label.toUpperCase()}` : j ? `WEEK ${j.week} OF ${j.title.toUpperCase()}` : 'KEEP MOVING',
    };
    if (Platform.OS === 'android') await SecureStore.setItemAsync(CACHE, JSON.stringify(data)).catch(() => undefined);
    return { data };
  } catch {
    const cached = await SecureStore.getItemAsync(CACHE).catch(() => null);
    return cached ? { data: JSON.parse(cached) } : { data: null, message: 'Waiting for a connection.' };
  }
}
