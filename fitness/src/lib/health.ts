// Samsung Health sync through Android's Health Connect. Samsung Health shares steps and exercise
// sessions into Health Connect, and Tandem reads them from there. Nothing leaves the phone except
// the sessions themselves, which import once each into your activity log.
import { Platform } from 'react-native';
import type * as HCTypes from 'react-native-health-connect';
import { api, type Summary } from './api';
import { iso } from './dates';
import { local } from './local';

// Loaded only on Android, so the web preview keeps working.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HC: typeof HCTypes | null = Platform.OS === 'android' ? require('react-native-health-connect') : null;

export type HealthState = 'unsupported' | 'install' | 'update' | 'ready';

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ExerciseSession' },
] as const;

export async function healthState(): Promise<HealthState> {
  if (!HC) return 'unsupported';
  try {
    const s = await HC.getSdkStatus();
    if (s === HC.SdkAvailabilityStatus.SDK_AVAILABLE) return 'ready';
    if (s === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update';
    return 'install';
  } catch {
    return 'install';
  }
}

/** Asks for permission to read steps and exercise. Returns true once both are granted. */
export async function connectHealth(): Promise<boolean> {
  if (!HC) return false;
  await HC.initialize();
  const granted = await HC.requestPermission([...PERMISSIONS] as unknown as HCTypes.Permission[]);
  const ok = PERMISSIONS.every((p) => granted.some((g) => 'recordType' in g && g.recordType === p.recordType));
  local.setHealth(ok);
  return ok;
}

export function openHealthSettings() { HC?.openHealthConnectSettings(); }

function kindFor(type: number): { kind: string; label: string } {
  const E = HC!.ExerciseType;
  const map: [number[], string, string][] = [
    [[E.WALKING], 'walk', 'Walk'],
    [[E.RUNNING, E.RUNNING_TREADMILL], 'jog', 'Run'],
    [[E.HIKING], 'outdoor', 'Hike'],
    [[E.BIKING, E.BIKING_STATIONARY], 'outdoor', 'Ride'],
    [[E.STAIR_CLIMBING, E.STAIR_CLIMBING_MACHINE], 'stairs', 'Stairs'],
    [[E.DANCING], 'dance', 'Dance'],
    [[E.YOGA, E.STRETCHING, E.PILATES], 'stretch', 'Stretch'],
    [[E.STRENGTH_TRAINING, E.CALISTHENICS, E.HIGH_INTENSITY_INTERVAL_TRAINING, E.WEIGHTLIFTING], 'home', 'Workout'],
  ];
  for (const [types, kind, label] of map) if (types.includes(type)) return { kind, label };
  return { kind: 'sport', label: 'Exercise' };
}

let syncing = false;

/**
 * Reads the last two weeks of exercise sessions and today's steps, and sends new sessions to the server.
 * Quietly does nothing when sync is off or Health Connect is unavailable.
 */
export async function syncHealth(): Promise<{ added: number; steps: number | null; summary?: Summary } | null> {
  if (!HC || !local.health() || syncing) return null;
  syncing = true;
  try {
    await HC.initialize();
    const now = new Date();
    const since = new Date(now.getTime() - 14 * 86400000);
    const sessions = await HC.readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime: now.toISOString() },
    });
    const rows = sessions.records
      .filter((r) => r.metadata?.dataOrigin !== 'com.mattdav30.tandem')
      .map((r) => {
        const start = new Date(r.startTime);
        const end = new Date(r.endTime);
        const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
        const { kind, label } = kindFor(r.exerciseType);
        return {
          external_id: r.metadata?.id ?? `${r.startTime}|${r.exerciseType}`,
          date: iso(start), minutes, kind, title: r.title?.trim() || `${label} (Samsung Health)`,
          source: (r.metadata?.dataOrigin ?? 'health').replace('com.sec.android.app.shealth', 'samsung'),
          start_ms: start.getTime(), end_ms: end.getTime(),
        };
      })
      .filter((r) => r.minutes >= 5 && r.minutes <= 600);

    let added = 0;
    let summary: Summary | undefined;
    if (rows.length) {
      const res = await api<{ added: number; summary: Summary }>('/api/fit/import', { method: 'POST', body: { sessions: rows } });
      added = res.added;
      summary = res.summary;
    }

    let steps: number | null = null;
    try {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const agg = await HC.aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime: startOfDay.toISOString(), endTime: now.toISOString() },
      });
      steps = agg.COUNT_TOTAL ?? null;
    } catch { /* steps permission missing */ }

    local.setHealthSynced(Date.now());
    return { added, steps, summary };
  } catch (e) {
    console.warn('Health sync failed', e);
    return null;
  } finally {
    syncing = false;
  }
}
