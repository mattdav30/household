import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';

export type Mode = 'dark' | 'light';
const KEY = 'household_theme';

function readMode(): Mode {
  try {
    const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return v === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** The theme is read once at start up. Changing it saves the choice and reloads the app. */
export const MODE: Mode = readMode();

export async function setMode(m: Mode) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, m);
    globalThis.location?.reload();
    return;
  }
  await SecureStore.setItemAsync(KEY, m);
  await Updates.reloadAsync().catch(() => undefined);
}

const dark = {
  bg: '#0B0F0E',
  card: '#141A18',
  raised: '#1C2421',
  ink: '#ECF2EF',
  sub: '#97A39E',
  faint: '#5F6B66',
  line: '#232D29',
  accent: '#34C08A',
  onAccent: '#03140D',
  accentSoft: 'rgba(52,192,138,0.14)',
  warm: '#F2875E',
  warmSoft: 'rgba(242,135,94,0.15)',
  danger: '#FF6B6B',
  backdrop: 'rgba(0,0,0,0.6)',
  tabBar: '#101513',
};

const light: typeof dark = {
  bg: '#F4F2EE',
  card: '#FFFFFF',
  raised: '#F7F5F1',
  ink: '#16201C',
  sub: '#5F6B66',
  faint: '#A3ABA7',
  line: '#E4E0D8',
  accent: '#16835E',
  onAccent: '#FFFFFF',
  accentSoft: '#E1F0EA',
  warm: '#C2603E',
  warmSoft: '#F7E6DF',
  danger: '#B3261E',
  backdrop: 'rgba(0,0,0,0.35)',
  tabBar: '#FFFFFF',
};

export const C = MODE === 'dark' ? dark : light;

export const R = { card: 18, pill: 999, input: 12 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Colours for calendar events and people. Bright enough for both themes. */
export const EVENT_COLORS = [
  { value: '#34C08A', label: 'Green' },
  { value: '#5B8DEF', label: 'Blue' },
  { value: '#A78BFA', label: 'Purple' },
  { value: '#EC6FA8', label: 'Pink' },
  { value: '#F06262', label: 'Red' },
  { value: '#F2875E', label: 'Orange' },
  { value: '#E8B931', label: 'Yellow' },
  { value: '#8C9A95', label: 'Grey' },
];
export const MEMBER_COLORS = ['#34C08A', '#F2875E', '#5B8DEF', '#A78BFA', '#E8B931', '#EC6FA8'];

// The first version stored darker person colours. Brighten them so they show on the dark theme.
const LEGACY: Record<string, string> = {
  '#1F6F5C': '#34C08A', '#B4654A': '#F2875E', '#3D5A80': '#5B8DEF', '#8A5A9E': '#A78BFA', '#C29A2E': '#E8B931', '#2F2F2F': '#8C9A95',
};
export const vivid = (c: string | null | undefined) => (c ? LEGACY[c] ?? c : C.sub);

/** Adds transparency to a #RRGGBB colour. */
export const tint = (hex: string, alpha: number) => hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
