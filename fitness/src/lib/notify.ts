// Reminders run on the phone itself, so nothing extra needs setting up for push.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Summary } from './api';
import { local } from './local';
import { todaysSession } from './plan';
import type { Equip } from './exercises';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let lastKey = '';

export async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Workout reminders', importance: Notifications.AndroidImportance.HIGH, lightColor: '#8B93FF',
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Plans the next three weeks of reminders: a morning nudge naming the day's session,
 * a Sunday night recap and a monthly progress photo day. Rebuilt whenever the data changes.
 */
export async function scheduleReminders(s: Summary) {
  if (Platform.OS === 'web') return;
  const me = s.members.find((m) => m.id === s.me);
  const hour = me?.reminder_hour;
  const key = JSON.stringify([s.today, hour, s.streaks[s.me]?.done_today, s.week.total, s.journey?.next, s.journey?.complete]);
  if (key === lastKey) return;
  lastKey = key;
  if (!(await ensurePermission())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const streak = s.streaks[s.me];
  const next = s.journey && s.journey.next != null ? s.journey.stops[s.journey.next] : null;

  for (let i = 0; i < 21; i++) {
    const date = addDays(s.today, i);
    const [y, m, d] = date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();

    if (hour != null && !(i === 0 && streak?.done_today)) {
      const at = new Date(y, m - 1, d, hour, 0, 0);
      if (at.getTime() > now + 60000) {
        const { session } = todaysSession({
          date, week: s.week_index + Math.floor(i / 7), level: me?.level ?? 1,
          equipment: s.settings.equipment as Equip[], quiet: local.quiet(),
        });
        const streakLine = i === 0 && streak && streak.days > 0 ? ` Keep your ${streak.days} day streak going.` : '';
        await Notifications.scheduleNotificationAsync({
          content: { title: `${DAYS[dow]}: ${session.title}`, body: `${session.minutes} minutes.${streakLine} Ten minutes still counts.`, data: { screen: '/' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
        });
      }
    }
    if (dow === 0) {
      const at = new Date(y, m - 1, d, 19, 0, 0);
      if (at.getTime() > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Your week is in',
            body: next ? `See your minutes, the challenge winner and how close you are to ${next.name}.` : 'See your minutes and the challenge winner.',
            data: { screen: '/journey' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
        });
      }
    }
    if (d === 1) {
      const at = new Date(y, m - 1, d, 9, 0, 0);
      if (at.getTime() > now) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Check in day', body: 'Take your monthly progress photo and measurements.', data: { screen: '/progress' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
        });
      }
    }
  }
}
