// Your own workouts: saved plans, the workout you are logging right now, and personal bests.
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { moveById, type Move, type Track } from './lifts';

export type PlanItem = { move_id: string; move_name: string; track: Track; sets: number; reps: number | null; weight_kg: number | null; seconds: number | null };
export type Template = { id: string; user_id: string; name: string; items: PlanItem[]; updated_at: number };

/** One set while logging. Numbers stay as typed text until saved, so half typed values are fine. */
export type LogSet = { weight: string; reps: string; secs: string; km: string; done: boolean };
export type LogExercise = { key: string; move: Move; sets: LogSet[] };
export type LiftSession = { name: string; templateId: string | null; startedAt: number; exercises: LogExercise[]; restSecs: number };

export type LastSet = { move_id: string; set_no: number; weight_kg: number | null; reps: number | null; seconds: number | null; distance_m: number | null; date: string };
export type Pb = { move_id: string; move_name: string; kind: 'weight' | 'e1rm' | 'reps' | 'time' | 'distance' | 'volume'; value: number; previous: number };
export type LiftSummary = {
  move_id: string; move_name: string; track: Track; sessions: number; last_date: string;
  best_weight: number | null; best_e1rm: number | null; best_reps: number | null; best_seconds: number | null; best_distance: number | null;
};
export type LiftSession2 = { workout_id: string; date: string; sets: { set_no: number; weight_kg: number | null; reps: number | null; seconds: number | null; distance_m: number | null }[] };

const blank = (): LogSet => ({ weight: '', reps: '', secs: '', km: '', done: false });
let n = 0;
export const keyOf = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

/** A fresh exercise in the logger, with planned sets filled in when it comes from a saved workout. */
export function exerciseFrom(move: Move, plan?: PlanItem): LogExercise {
  const count = plan?.sets ?? (move.track === 'cardio' ? 1 : 3);
  const s: LogSet = {
    ...blank(),
    weight: plan?.weight_kg != null ? String(plan.weight_kg) : '',
    reps: plan?.reps != null ? String(plan.reps) : '',
    secs: plan?.seconds != null ? String(plan.seconds) : '',
  };
  return { key: keyOf(), move, sets: Array.from({ length: count }, () => ({ ...s })) };
}
export const sessionFrom = (t: Template | null): LiftSession => ({
  name: t?.name ?? 'Workout',
  templateId: t?.id ?? null,
  startedAt: Date.now(),
  exercises: (t?.items ?? []).map((it) => exerciseFrom(moveById(it.move_id, it.move_name, it.track), it)),
  restSecs: 90,
});

// The workout in progress lives in a file, so closing the app keeps it.
const file = () => new File(Paths.document, 'tandem-lift.json');
let current: LiftSession | null | undefined;
export function loadLift(): LiftSession | null {
  if (current !== undefined) return current;
  current = null;
  if (Platform.OS === 'web') return current;
  try { const f = file(); if (f.exists) current = JSON.parse(f.textSync()) as LiftSession; } catch { current = null; }
  return current;
}
export function saveLift(s: LiftSession | null) {
  current = s;
  if (Platform.OS === 'web') return;
  try {
    const f = file();
    if (!s) { if (f.exists) f.delete(); return; }
    if (!f.exists) f.create();
    f.write(JSON.stringify(s));
  } catch { /* the next change saves again */ }
}

const numOr = (s: string) => { const v = Number(s.replace(',', '.')); return s.trim() && isFinite(v) && v > 0 ? v : null; };
/** A set counts when it is ticked and has the numbers its kind needs. */
export function setValues(track: Track, s: LogSet) {
  const w = numOr(s.weight);
  const r = numOr(s.reps);
  const secs = numOr(s.secs);
  const km = numOr(s.km);
  switch (track) {
    case 'weight': return r ? { weight_kg: w, reps: Math.round(r), seconds: null, distance_m: null } : null;
    case 'reps': return r ? { weight_kg: null, reps: Math.round(r), seconds: null, distance_m: null } : null;
    case 'time': return secs ? { weight_kg: null, reps: null, seconds: Math.round(secs), distance_m: null } : null;
    case 'cardio': return secs || km ? { weight_kg: null, reps: null, seconds: secs ? Math.round(secs * 60) : null, distance_m: km ? Math.round(km * 1000) : null } : null;
  }
}

/** Plan to save from what was actually done, for "save as a workout". */
export const planFrom = (s: LiftSession): PlanItem[] => s.exercises.map((e) => {
  const done = e.sets.filter((x) => x.done);
  const last = done[done.length - 1] ?? e.sets[e.sets.length - 1];
  return {
    move_id: e.move.id, move_name: e.move.name, track: e.move.track, sets: Math.max(1, done.length || e.sets.length),
    reps: numOr(last?.reps ?? ''), weight_kg: numOr(last?.weight ?? ''), seconds: numOr(last?.secs ?? ''),
  };
});

export function pbText(p: Pb) {
  switch (p.kind) {
    case 'weight': return `Heaviest: ${p.value} kg (was ${p.previous} kg)`;
    case 'e1rm': return `Best estimated max: ${p.value} kg (was ${p.previous} kg)`;
    case 'reps': return `Most reps: ${p.value} (was ${p.previous})`;
    case 'time': return `Longest: ${p.value}s (was ${p.previous}s)`;
    case 'distance': return `Furthest: ${(p.value / 1000).toFixed(2)} km (was ${(p.previous / 1000).toFixed(2)} km)`;
    case 'volume': return `Most volume: ${p.value.toLocaleString()} kg (was ${p.previous.toLocaleString()} kg)`;
  }
}

/** Short description of a set, like "40 kg × 8" or "1:30". */
export function setText(track: Track, s: { weight_kg: number | null; reps: number | null; seconds: number | null; distance_m: number | null }) {
  if (track === 'weight') return s.weight_kg != null ? `${s.weight_kg} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
  if (track === 'reps') return `${s.reps ?? 0} reps`;
  if (track === 'time') { const t = s.seconds ?? 0; return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : `${t}s`; }
  const parts = [];
  if (s.seconds) parts.push(`${Math.round(s.seconds / 60)} min`);
  if (s.distance_m) parts.push(`${(s.distance_m / 1000).toFixed(2)} km`);
  return parts.join(' · ');
}
