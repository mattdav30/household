// GPS tracking for walks and runs. Records the route with the screen off through Android's
// foreground location service, so a notification shows while a walk is being tracked.
// The live walk is saved to a file as it goes, so it survives the app closing.
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { File, Paths } from 'expo-file-system';

export const GPS_TASK = 'tandem-gps';
export type TrackKind = 'walk' | 'run';
/** One GPS fix. a = active milliseconds since the start (pauses taken out), seg = which stretch between pauses. */
export type Pt = { t: number; a: number; lat: number; lng: number; acc: number; alt: number | null; seg: number };
export type Track = {
  kind: TrackKind; startedAt: number; pausedMs: number; pausedAt: number | null; seg: number;
  points: Pt[]; background: boolean;
};

let track: Track | null = null;
let loaded = false;
let lastSave = 0;
let watcher: Location.LocationSubscription | null = null;
const listeners = new Set<() => void>();

const file = () => new File(Paths.document, 'tandem-track.json');
function load(): Track | null {
  if (loaded) return track;
  loaded = true;
  try { const f = file(); if (f.exists) track = JSON.parse(f.textSync()) as Track; } catch { track = null; }
  return track;
}
function save(force = false) {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  if (!force && now - lastSave < 8000) return;
  lastSave = now;
  try {
    const f = file();
    if (!track) { if (f.exists) f.delete(); return; }
    if (!f.exists) f.create();
    f.write(JSON.stringify(track));
  } catch { /* the next save tries again */ }
}
const emit = () => listeners.forEach((l) => l());
export const onTrack = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const currentTrack = () => load();

/** Distance in metres between two fixes. */
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Adds fixes, dropping blurry ones, repeats, and jumps faster than a person could move. */
function addFixes(locs: Location.LocationObject[]) {
  const tr = load();
  if (!tr || tr.pausedAt) return;
  const maxSpeed = tr.kind === 'run' ? 9 : 4.5; // metres a second
  let added = false;
  for (const l of [...locs].sort((x, y) => x.timestamp - y.timestamp)) {
    const acc = l.coords.accuracy ?? 99;
    if (acc > 35) continue;
    const last = tr.points[tr.points.length - 1];
    const p: Pt = {
      t: l.timestamp, a: Math.max(0, l.timestamp - tr.startedAt - tr.pausedMs), lat: l.coords.latitude, lng: l.coords.longitude,
      acc: Math.round(acc), alt: l.coords.altitude != null ? Math.round(l.coords.altitude * 10) / 10 : null, seg: tr.seg,
    };
    if (last) {
      if (p.t <= last.t) continue;
      if (last.seg === p.seg) {
        const d = metres(last, p);
        if (d / Math.max(0.5, (p.t - last.t) / 1000) > maxSpeed) continue;
        if (d < Math.max(3, acc * 0.25)) continue; // standing still, GPS drift
      }
    }
    tr.points.push(p);
    added = true;
  }
  if (added) { save(); emit(); }
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask(GPS_TASK, async ({ data, error }) => {
    if (error) return;
    const locs = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    addFixes(locs);
  });
}

export type GpsAccess = 'ready' | 'foreground' | 'denied' | 'off';
/** Asks for location. 'foreground' means tracking works while the app stays open, 'ready' covers the screen off too. */
export async function askGps(): Promise<GpsAccess> {
  if (Platform.OS === 'web') return 'denied';
  if (!(await Location.hasServicesEnabledAsync())) return 'off';
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === 'granted') return 'ready';
  } catch { /* some phones refuse the request outright */ }
  return 'foreground';
}

/** A quick fix for the ready screen, so you can see the GPS has locked on before starting. */
export async function quickFix() {
  try {
    const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: l.coords.latitude, lng: l.coords.longitude, acc: Math.round(l.coords.accuracy ?? 99) };
  } catch { return null; }
}

async function startUpdates(tr: Track) {
  if (tr.background) {
    const already = await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false);
    if (!already) {
      await Location.startLocationUpdatesAsync(GPS_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 3,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        foregroundService: {
          notificationTitle: tr.kind === 'run' ? 'Tracking your run' : 'Tracking your walk',
          notificationBody: 'Open Tandem to pause or finish.',
          notificationColor: '#8B93FF',
          killServiceOnDestroy: false,
        },
      });
    }
  }
  // Also watch while the screen is open, for snappy updates. Duplicate fixes are dropped.
  watcher?.remove();
  watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1500, distanceInterval: 2 }, (l) => addFixes([l]));
}
async function stopUpdates() {
  watcher?.remove();
  watcher = null;
  if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(GPS_TASK).catch(() => undefined);
}

export async function startTrack(kind: TrackKind, access: GpsAccess) {
  track = { kind, startedAt: Date.now(), pausedMs: 0, pausedAt: null, seg: 0, points: [], background: access === 'ready' };
  loaded = true;
  save(true);
  await startUpdates(track);
  emit();
}
/** Picks a walk back up after the app was closed, or after returning to the tracker screen. */
export async function resumeWatching() {
  const tr = load();
  if (!tr || tr.pausedAt) return;
  await startUpdates(tr);
}
export async function pauseTrack() {
  const tr = load();
  if (!tr || tr.pausedAt) return;
  tr.pausedAt = Date.now();
  await stopUpdates();
  save(true);
  emit();
}
export async function resumeTrack() {
  const tr = load();
  if (!tr || !tr.pausedAt) return;
  tr.pausedMs += Date.now() - tr.pausedAt;
  tr.pausedAt = null;
  tr.seg += 1;
  save(true);
  await startUpdates(tr);
  emit();
}
/** Stops tracking and returns the finished walk. Call clearTrack once it is saved. */
export async function finishTrack(): Promise<Track | null> {
  const tr = load();
  if (!tr) return null;
  if (!tr.pausedAt) tr.pausedAt = Date.now();
  await stopUpdates();
  save(true);
  emit();
  return tr;
}
export function clearTrack() {
  track = null;
  loaded = true;
  save(true);
  emit();
}
/** Stops listening when leaving the tracker screen. Background tracking carries on. */
export function stopWatching() { watcher?.remove(); watcher = null; }

export type Stats = { activeMs: number; distance: number; pace: number | null; nowPace: number | null; splits: number[]; climb: number };
/** Time, distance, average and current pace (seconds per km), kilometre splits (seconds each) and climb (metres). */
export function statsOf(tr: Track, now = Date.now()): Stats {
  const activeMs = Math.max(0, (tr.pausedAt ?? now) - tr.startedAt - tr.pausedMs);
  let distance = 0;
  let climb = 0;
  const splits: number[] = [];
  let nextKm = 1000;
  let lastSplitA = 0;
  let altBase: number | null = null;
  for (let i = 1; i < tr.points.length; i++) {
    const a = tr.points[i - 1];
    const b = tr.points[i];
    if (a.seg !== b.seg) { altBase = b.alt; continue; }
    const d = metres(a, b);
    if (distance + d >= nextKm) {
      // Time at the exact kilometre mark, between these two fixes.
      const f = (nextKm - distance) / d;
      const at = a.a + (b.a - a.a) * f;
      splits.push(Math.round((at - lastSplitA) / 1000));
      lastSplitA = at;
      nextKm += 1000;
    }
    distance += d;
    // Climb with a 3 metre dead band, since GPS height wobbles.
    if (b.alt != null) {
      if (altBase == null) altBase = b.alt;
      else if (b.alt - altBase >= 3) { climb += b.alt - altBase; altBase = b.alt; }
      else if (altBase - b.alt >= 3) altBase = b.alt;
    }
  }
  const pace = distance >= 50 ? activeMs / 1000 / (distance / 1000) : null;
  // Current pace over the last 30 seconds of fixes.
  let nowPace: number | null = null;
  const pts = tr.points;
  const last = pts[pts.length - 1];
  if (last && !tr.pausedAt && now - last.t < 15000) {
    let d = 0;
    let j = pts.length - 1;
    while (j > 0 && pts[j - 1].seg === last.seg && last.a - pts[j - 1].a <= 30000) { d += metres(pts[j - 1], pts[j]); j--; }
    const span = (last.a - pts[j].a) / 1000;
    if (d > 15 && span > 5) nowPace = span / (d / 1000);
  }
  return { activeMs, distance, pace, nowPace, splits, climb: Math.round(climb) };
}

export const fmtKm = (m: number) => (m / 1000).toFixed(m < 10000 ? 2 : 1);
export function fmtPace(secPerKm: number | null) {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm > 3600) return '--:--';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Google's polyline format: compact text for the route, about five bytes a point. */
export function encodePolyline(pts: { lat: number; lng: number }[]) {
  let out = '';
  let pLat = 0;
  let pLng = 0;
  const enc = (v: number) => {
    let x = v < 0 ? ~(v << 1) : v << 1;
    while (x >= 0x20) { out += String.fromCharCode((0x20 | (x & 0x1f)) + 63); x >>= 5; }
    out += String.fromCharCode(x + 63);
  };
  for (const p of pts) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    enc(lat - pLat); enc(lng - pLng);
    pLat = lat; pLng = lng;
  }
  return out;
}
export function decodePolyline(s: string) {
  const pts: { lat: number; lng: number }[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const dec = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) { lat += dec(); lng += dec(); pts.push({ lat: lat / 1e5, lng: lng / 1e5 }); }
  return pts;
}
/** Splits a route into stretches between pauses, as polylines joined with a space. */
export function encodeTrack(pts: Pt[]) {
  const segs: Pt[][] = [];
  for (const p of pts) { if (!segs.length || segs[segs.length - 1][0].seg !== p.seg) segs.push([]); segs[segs.length - 1].push(p); }
  return segs.map(encodePolyline).join(' ');
}
export const decodeTrack = (s: string) => s.split(' ').filter(Boolean).map(decodePolyline);
