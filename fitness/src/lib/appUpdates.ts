// Keeps Tandem current without visiting expo.dev.
// Small changes (screens, wording, logic) arrive over the air from Expo and apply with one tap.
// Bigger changes need a new install; the server says which build is newest and the app offers it.
import { Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { api } from './api';

export type Release = { version: string; url: string; notes: string | null };
export type UpdateStatus = { otaReady: boolean; release: Release | null };

/** The installed build's version, for example 1.1.0. */
export const installedVersion = (): string => Updates.runtimeVersion ?? '1.0.0';

/** When the code running now was published, or null for the code built into the install. */
export const runningSince = (): Date | null => (Updates.isEmbeddedLaunch ? null : Updates.createdAt);

function newer(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

let otaReady = false;

/** Downloads any over the air update in the background. Returns true once one is ready to apply. */
async function checkOta(): Promise<boolean> {
  if (Platform.OS === 'web' || !Updates.isEnabled) return false;
  if (otaReady) return true;
  try {
    const res = await Updates.checkForUpdateAsync();
    if (!res.isAvailable) return false;
    const fetched = await Updates.fetchUpdateAsync();
    otaReady = fetched.isNew;
    return otaReady;
  } catch {
    return false;
  }
}

async function checkRelease(): Promise<Release | null> {
  if (Platform.OS === 'web') return null;
  try {
    const r = await api<Release | null>('/api/fit/app-release');
    return r && newer(r.version, installedVersion()) ? r : null;
  } catch {
    return null;
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const [ota, release] = await Promise.all([checkOta(), checkRelease()]);
  return { otaReady: ota, release };
}

/** Restarts into the downloaded update. */
export const applyUpdate = () => Updates.reloadAsync().catch(() => undefined);

/** Opens the new build's install file. Android asks to confirm the install. */
export const installRelease = (r: Release) => Linking.openURL(r.url);

/** Short technical details for Settings, so a stuck update is easy to diagnose. */
export async function updateDetails(): Promise<string> {
  if (Platform.OS === 'web' || !Updates.isEnabled) return 'Updates are off in this build.';
  const parts = [
    `Channel ${Updates.channel ?? 'none'}`,
    Updates.isEmbeddedLaunch ? 'install file code' : `update ${(Updates.updateId ?? '').slice(0, 8)}`,
    Updates.createdAt ? `made ${Updates.createdAt.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : '',
  ];
  if (Updates.isEmergencyLaunch) parts.push(`fell back: ${Updates.emergencyLaunchReason ?? 'unknown reason'}`);
  try {
    const logs = await Updates.readLogEntriesAsync(2 * 24 * 3600 * 1000);
    const errs = logs.filter((l) => l.level === 'error' || l.level === 'fatal').slice(-2);
    for (const e of errs) parts.push(`error: ${e.message.slice(0, 140)}`);
  } catch { /* logs unavailable */ }
  return parts.filter(Boolean).join(' · ');
}
