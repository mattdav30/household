// Settings that belong to this phone only.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const web = Platform.OS === 'web';
function read(key: string): string | null {
  try { return web ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItem(key); } catch { return null; }
}
function write(key: string, v: string | null) {
  try {
    if (web) { if (v == null) globalThis.localStorage?.removeItem(key); else globalThis.localStorage?.setItem(key, v); return; }
    if (v == null) SecureStore.deleteItemAsync(key).catch(() => undefined); else SecureStore.setItem(key, v);
  } catch { /* ignore */ }
}

export const local = {
  /** Quiet mode drops jumping moves, for late nights and neighbours below. */
  quiet: () => read('rtt_quiet') === '1',
  setQuiet: (on: boolean) => write('rtt_quiet', on ? '1' : null),
  /** Spoken cues during workouts. */
  voice: () => read('rtt_voice') !== '0',
  setVoice: (on: boolean) => write('rtt_voice', on ? null : '0'),
  /** Shuffle number per date, so a reshuffled workout survives leaving the screen. */
  shuffle: (date: string) => {
    const v = read('rtt_shuffle');
    if (!v) return 0;
    const [d, n] = v.split(':');
    return d === date ? Number(n) || 0 : 0;
  },
  setShuffle: (date: string, n: number) => write('rtt_shuffle', `${date}:${n}`),
  /** Hides the step up suggestion for a week after Stay here. */
  stepUpSnoozed: (today: string) => { const v = read('rtt_stepup'); return !!v && v > today; },
  snoozeStepUp: (today: string) => {
    const [y, m, d] = today.split('-').map(Number);
    const t = new Date(y, m - 1, d + 7);
    write('rtt_stepup', `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
  },
  summaryCache: () => read('rtt_summary'),
  setSummaryCache: (json: string) => { if (json.length < 1900) write('rtt_summary', json); },
};
