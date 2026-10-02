import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, loadToken } from '../lib/api';
import type { WidgetData } from './TodayWidget';

const CACHE = 'household_widget_cache';

/** Today's data for the widget, falling back to the last good copy when offline. */
export async function loadWidgetData(): Promise<{ data: WidgetData | null; message?: string }> {
  const token = await loadToken();
  if (!token) return { data: null, message: 'Open Household and sign in.' };
  try {
    const t = await api<Omit<WidgetData, 'updatedAt'>>('/api/today');
    const data: WidgetData = {
      today: t.today,
      events: t.events.map((e) => ({ title: e.title, date: e.date, start_time: e.start_time, holiday: e.holiday, color: e.color })).slice(0, 6),
      meals: t.meals.map((m) => ({ title: m.title, slot: m.slot })),
      shopping_open: t.shopping_open,
      chores: [],
      updatedAt: Date.now(),
    };
    if (Platform.OS === 'android') await SecureStore.setItemAsync(CACHE, JSON.stringify(data)).catch(() => undefined);
    return { data };
  } catch {
    const cached = await SecureStore.getItemAsync(CACHE).catch(() => null);
    return cached ? { data: JSON.parse(cached) } : { data: null, message: 'Waiting for a connection.' };
  }
}
