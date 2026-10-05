import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';

export type Mode = 'dark' | 'light';
const KEY = 'rtt_theme';

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
  bg: '#0E0D1A',
  card: '#17152A',
  raised: '#211F39',
  ink: '#EEEDF7',
  sub: '#A3A1BC',
  faint: '#67647F',
  line: '#27253F',
  accent: '#8B93FF',
  onAccent: '#0B0B24',
  accentSoft: 'rgba(139,147,255,0.16)',
  warm: '#F59AB8',
  warmSoft: 'rgba(245,154,184,0.15)',
  gold: '#F2C96B',
  goldSoft: 'rgba(242,201,107,0.15)',
  green: '#34C08A',
  danger: '#FF6B6B',
  backdrop: 'rgba(0,0,0,0.6)',
  tabBar: '#121124',
};

const light: typeof dark = {
  bg: '#F5F4FA',
  card: '#FFFFFF',
  raised: '#F1F0F8',
  ink: '#17162B',
  sub: '#5E5C78',
  faint: '#A6A4BC',
  line: '#E3E1EE',
  accent: '#5560E8',
  onAccent: '#FFFFFF',
  accentSoft: '#E7E8FF',
  warm: '#C2507A',
  warmSoft: '#F8E3EC',
  gold: '#A87A12',
  goldSoft: '#F7EED7',
  green: '#16835E',
  danger: '#B3261E',
  backdrop: 'rgba(0,0,0,0.35)',
  tabBar: '#FFFFFF',
};

export const C = MODE === 'dark' ? dark : light;

export const R = { card: 18, pill: 999, input: 12 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// Household stored darker person colours at first. Brighten them so they show on the dark theme.
const LEGACY: Record<string, string> = {
  '#1F6F5C': '#34C08A', '#B4654A': '#F2875E', '#3D5A80': '#5B8DEF', '#8A5A9E': '#A78BFA', '#C29A2E': '#E8B931', '#2F2F2F': '#8C9A95',
};
export const vivid = (c: string | null | undefined) => (c ? LEGACY[c] ?? c : C.sub);

/** Adds transparency to a #RRGGBB colour. */
export const tint = (hex: string, alpha: number) => hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
