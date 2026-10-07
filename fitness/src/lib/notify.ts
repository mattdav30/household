// Reminders run on the phone itself, so nothing extra needs setting up for push.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Summary } from './api';

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
 * Plans the next three weeks of reminders from the pet: a morning nudge with today's step,
 * a 6pm nudge while the day is still open, a Sunday recap and a monthly check in.
 * Rebuilt whenever the data changes, so logging a walk cancels tonight's nudge.
 */
export async function scheduleReminders(s: Summary) {
  if (Platform.OS === 'web') return;
  const me = s.members.find((m) => m.id === s.me);
  if (!me) return;
  const pet = s.pet.name ?? 'Your pet';
  const done = !!s.streaks[s.me]?.done_today;
  // When the bowl gets low, to the nearest hour, so the hungry reminder moves when someone feeds the dog.
  const hungryAt = s.pet.needs ? Math.round(s.pet.needs.hungry_at / 3600000) : 0;
  const key = JSON.stringify([s.today, me.reminder_hour, me.evening_nudge, me.step, done, pet, hungryAt]);
  if (key === lastKey) return;
  lastKey = key;
  if (!(await ensurePermission())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const streak = s.streaks[s.me]?.days ?? 0;
  const step = s.steps.find((x) => x.step === me.step);
  const at = (date: string, h: number) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d, h, 0, 0); };
  const schedule = async (when: Date, title: string, body: string, screen = '/') => {
    if (when.getTime() <= now + 60000) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { screen } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'reminders' },
    });
  };

  // Tamagotchi style nudge when the bowl runs low. Kept to daytime hours.
  if (s.pet.needs) {
    const when = new Date(Math.max(s.pet.needs.hungry_at, now + 3600000));
    if (when.getHours() < 8) when.setHours(8, 0, 0, 0);
    else if (when.getHours() >= 21) { when.setDate(when.getDate() + 1); when.setHours(8, 0, 0, 0); }
    await schedule(when, `${pet} is getting hungry`, 'The bowl is nearly empty. Ten minutes of moving fills a third of it.', '/dog');
  }
  for (let i = 0; i < 21; i++) {
    const date = addDays(s.today, i);
    const when = at(date, 0);
    const dow = when.getDay();
    const skip = i === 0 && done;
    if (me.reminder_hour != null && !skip) {
      await schedule(at(date, me.reminder_hour), `${pet} is ready for a walk`, `${DAYS[dow]}: ${step?.title ?? 'a short walk'}, ${me.target} minutes. Ten minutes still counts.`);
    }
    if (me.evening_nudge && !skip && me.reminder_hour !== 18) {
      await schedule(at(date, 18), `${pet} is still waiting`,
        i === 0 && streak > 0 ? `A ten minute walk before dinner keeps your ${streak} day streak.` : 'A ten minute walk before dinner keeps the day going.');
    }
    if (dow === 0) await schedule(at(date, 19), `Your week with ${pet}`, 'See how many minutes you both moved this week.', '/progress');
    if (when.getDate() === 1) await schedule(at(date, 9), 'Check in day', 'Take your monthly progress photo and measurements.', '/progress');
  }
}
