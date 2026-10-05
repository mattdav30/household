// Builds each day's session from the exercise library. The same date always gives the same
// workout on both phones, so the two of you can train together, and a shuffle gives a new mix.
import { EXERCISES, byId, type Area, type Equip, type Exercise } from './exercises';
import type { Weather } from './weather';

export type SessionType = 'strength' | 'hiit' | 'tabata' | 'stretch' | 'partner' | 'walk' | 'stairs' | 'dance' | 'quick';
export type Step = {
  name: string;
  seconds: number;
  kind: 'warm' | 'work' | 'rest' | 'cool' | 'move';
  exId?: string;
  cue?: string;
};
export type Session = {
  type: SessionType;
  title: string;
  blurb: string;
  minutes: number;
  logKind: string; // matches the API kinds
  outdoor: boolean;
  partner: boolean;
  steps: Step[];
  place?: { name: string; tip: string };
  note?: string;
};

export type PlanInput = {
  date: string; // YYYY-MM-DD
  week: number; // weeks since the journey started
  level: number; // 1 easy start, 2 steady, 3 strong
  equipment: Equip[];
  quiet: boolean; // no jumping
  weather?: Weather | null;
  shuffle?: number;
};

export const TYPE_INFO: Record<SessionType, { label: string; short: string; icon: string; color: 'accent' | 'warm' | 'gold' | 'green'; blurb: string }> = {
  strength: { short: 'Strength', label: 'Strength circuit', icon: 'arm-flex', color: 'accent', blurb: 'Full body circuit. Builds the muscle that shapes the suit and the dress.' },
  hiit: { short: 'Cardio', label: 'Cardio and core', icon: 'heart-pulse', color: 'warm', blurb: 'Intervals that raise your heart rate, finished with core.' },
  tabata: { short: 'Tabata', label: 'Tabata blast', icon: 'lightning-bolt', color: 'gold', blurb: '20 seconds hard, 10 seconds rest. Short and sharp.' },
  stretch: { short: 'Stretch', label: 'Stretch and recover', icon: 'yoga', color: 'green', blurb: 'Easy mobility for rest days. Counts towards your streak.' },
  partner: { short: 'Partner', label: 'Partner workout', icon: 'account-heart', color: 'warm', blurb: 'Built for two. High fives included.' },
  walk: { short: 'Walk', label: 'Interval walk', icon: 'walk', color: 'green', blurb: 'Brisk walking with faster bursts. Outdoors, no gear.' },
  stairs: { short: 'Stairs', label: 'Stair session', icon: 'stairs', color: 'gold', blurb: 'Climb, recover, repeat. Brisbane has great stairs.' },
  dance: { short: 'Dance', label: 'First dance practice', icon: 'music-note', color: 'accent', blurb: 'Rehearse your wedding dance. Every minute counts.' },
  quick: { short: 'Ten min', label: 'Ten minute floor', icon: 'timer-sand', color: 'accent', blurb: 'Low on drive? Ten minutes keeps the streak alive.' },
};

/** Free outdoor spots around Brisbane. */
export const PLACES = [
  { name: 'Kangaroo Point Cliffs stairs', tip: 'Around 100 steps from the riverside path to the top. Climb up, walk down, repeat.', for: ['stairs'] },
  { name: 'New Farm Riverwalk', tip: 'Flat river path, good for interval walks. Lit at night.', for: ['walk'] },
  { name: 'Botanic Gardens and Goodwill Bridge loop', tip: 'A loop through the gardens and across to South Bank and back.', for: ['walk'] },
  { name: 'Roma Street Parkland', tip: 'Hilly paths and stairs in the city. Shady in summer.', for: ['walk', 'stairs'] },
  { name: 'Kedron Brook bikeway', tip: 'Long flat path for longer walks or walk jog intervals.', for: ['walk'] },
  { name: 'Your local park outdoor gym', tip: 'Brisbane City Council parks have free outdoor fitness stations. Pair with a strength circuit.', for: ['walk', 'stairs'] },
];

// Small deterministic random generator, so a date always builds the same session.
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickN = <T,>(arr: T[], n: number, r: () => number) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 0 at the very start for an easy starter, up to about 1.7 for a strong person late in the plan. */
export function difficulty(week: number, level: number) {
  return clamp(week / 30, 0, 1) + (clamp(level, 1, 3) - 1) * 0.35;
}

function pool(p: PlanInput, area: Area | Area[], opts: { partner?: boolean } = {}) {
  const areas = Array.isArray(area) ? area : [area];
  const have = new Set<Equip>(['none', ...p.equipment]);
  return EXERCISES.filter((e) => areas.includes(e.area)
    && have.has(e.equip)
    && (e.level ?? 1) <= p.level + (p.week >= 16 ? 1 : 0)
    && !(p.quiet && e.impact === 'high')
    && !!e.partner === !!opts.partner);
}

function warmUp(): Step[] {
  return ['march', 'arm-circles', 'hip-circles', 'torso-twist', 'leg-swings', 'slow-squat'].map((id) => ({
    name: byId(id)!.name, seconds: 30, kind: 'warm', exId: id,
  }));
}
function coolDown(r: () => number, n = 4): Step[] {
  const moves = pickN(EXERCISES.filter((e) => e.area === 'mobility'), n, r);
  return moves.map((e) => ({ name: e.name, seconds: e.sides ? 60 : 40, kind: 'cool', exId: e.id, cue: e.sides ? 'Switch sides halfway' : undefined }));
}
const work = (e: Exercise, seconds: number): Step => ({ name: e.name, seconds, kind: 'work', exId: e.id, cue: e.sides ? 'Switch sides halfway' : undefined });
const rest = (seconds: number, next?: Exercise): Step => ({ name: 'Rest', seconds, kind: 'rest', cue: next ? `Next: ${next.name}` : undefined });

function minutesOf(steps: Step[]) {
  return Math.max(1, Math.round(steps.reduce((t, s) => t + s.seconds, 0) / 60));
}

function circuit(p: PlanInput, r: () => number, moves: Exercise[], rounds: number, on: number, off: number, roundRest: number): Step[] {
  const steps: Step[] = [];
  for (let round = 0; round < rounds; round++) {
    moves.forEach((e, i) => {
      steps.push({ ...work(e, on), cue: `Round ${round + 1} of ${rounds}${e.sides ? '. Switch sides halfway' : ''}` });
      const last = i === moves.length - 1;
      if (!last) steps.push(rest(off, moves[i + 1]));
      else if (round < rounds - 1) steps.push({ name: 'Round rest', seconds: roundRest, kind: 'rest', cue: `Next: ${moves[0].name}. Grab some water.` });
    });
  }
  return steps;
}

export function buildSession(type: SessionType, p: PlanInput): Session {
  const r = rng(`${p.date}:${type}:${p.shuffle ?? 0}`);
  const d = difficulty(p.week, p.level);
  const info = TYPE_INFO[type];
  const base = { type, title: info.label, blurb: info.blurb, outdoor: false, partner: false, logKind: 'home' };
  const pick = (area: Area, n = 1, partner = false) => pickN(pool(p, area, { partner }), n, r);

  if (type === 'strength') {
    const moves = [...pick('legs', 2), ...pick('push'), ...pick('pull'), ...pick('core'), ...pick('legs')]
      .filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i);
    const rounds = 2 + Math.round(d * 1.3);
    const on = 30 + Math.round(d * 12);
    const off = Math.max(15, 30 - Math.round(d * 10));
    const steps = [...warmUp(), ...circuit(p, r, moves, rounds, on, off, 60), ...coolDown(r)];
    return { ...base, steps, minutes: minutesOf(steps), note: `${rounds} rounds of ${moves.length} moves, ${on}s on and ${off}s off.` };
  }

  if (type === 'hiit') {
    const cardio = pick('cardio', 4);
    const core = pick('core', 2);
    const rounds = 2 + Math.round(d);
    const on = 30 + Math.round(d * 10);
    const off = Math.max(15, 30 - Math.round(d * 10));
    const steps = [...warmUp(), ...circuit(p, r, cardio, rounds, on, off, 60), { name: 'Rest', seconds: 45, kind: 'rest' as const, cue: 'Core finisher next' }, ...circuit(p, r, core, 2, on, off, 30), ...coolDown(r, 3)];
    return { ...base, steps, minutes: minutesOf(steps), note: `${rounds} cardio rounds, then a core finisher.` };
  }

  if (type === 'tabata') {
    const blocks = 2 + Math.round(d * 1.2);
    const moves = pickN([...pool(p, 'cardio'), ...pool(p, 'legs'), ...pool(p, 'core')], blocks * 2, r);
    const steps: Step[] = [...warmUp()];
    for (let b = 0; b < blocks; b++) {
      const pair = moves.slice(b * 2, b * 2 + 2);
      for (let i = 0; i < 8; i++) {
        const e = pair[i % pair.length];
        steps.push({ ...work(e, 20), cue: `Block ${b + 1} of ${blocks}, interval ${i + 1} of 8` });
        steps.push(i < 7 ? rest(10, pair[(i + 1) % pair.length]) : { name: 'Block rest', seconds: 60, kind: 'rest', cue: b < blocks - 1 ? 'Shake it out. Next block soon.' : 'Last block done.' });
      }
    }
    steps.push(...coolDown(r, 3));
    return { ...base, steps, minutes: minutesOf(steps), note: `${blocks} blocks of eight 20 second bursts.` };
  }

  if (type === 'stretch') {
    const moves = pickN(EXERCISES.filter((e) => e.area === 'mobility' && (e.equip === 'none' || p.equipment.includes(e.equip))), 9, r);
    const hold = 45 + Math.round(d * 10);
    const steps: Step[] = [{ name: 'March on the spot', seconds: 60, kind: 'warm', exId: 'march' }, ...moves.map((e) => ({
      name: e.name, seconds: e.sides ? hold * 2 : hold, kind: 'move' as const, exId: e.id, cue: e.sides ? 'Switch sides halfway' : 'Breathe slowly',
    }))];
    return { ...base, logKind: 'stretch', steps, minutes: minutesOf(steps) };
  }

  if (type === 'partner') {
    const moves = pickN(pool(p, ['legs', 'push', 'core', 'cardio'], { partner: true }), 6, r);
    const rounds = 2 + Math.round(d);
    const on = 35 + Math.round(d * 10);
    const steps = [...warmUp(), ...circuit(p, r, moves, rounds, on, 20, 60), ...coolDown(r, 3)];
    return { ...base, partner: true, logKind: 'partner', steps, minutes: minutesOf(steps), note: 'Logs for both of you when you finish together.' };
  }

  if (type === 'walk') {
    const jog = d >= 0.6;
    const intervals = 4 + Math.round(d * 3);
    const fast = 60 + Math.round(d * 30);
    const steps: Step[] = [{ name: 'Easy walk', seconds: 300, kind: 'warm', cue: 'Loosen up. Comfortable pace.' }];
    for (let i = 0; i < intervals; i++) {
      steps.push({ name: 'Brisk walk', seconds: 180, kind: 'move', cue: `Interval ${i + 1} of ${intervals}. Walk like you are late for a train.` });
      steps.push({ name: jog ? 'Easy jog' : 'Fast walk', seconds: fast, kind: 'work', cue: jog ? 'Gentle jog. You should still be able to talk.' : 'As fast as you can walk, arms pumping.' });
    }
    steps.push({ name: 'Easy walk', seconds: 300, kind: 'cool', cue: 'Bring your breathing back down.' });
    const place = pickN(PLACES.filter((x) => x.for.includes('walk')), 1, r)[0];
    return { ...base, title: jog ? 'Walk jog intervals' : info.label, outdoor: true, logKind: jog ? 'jog' : 'walk', steps, minutes: minutesOf(steps), place };
  }

  if (type === 'stairs') {
    const climbs = 5 + Math.round(d * 4);
    const steps: Step[] = [{ name: 'Walk to warm up', seconds: 300, kind: 'warm', cue: 'Easy pace on the flat.' }];
    const extras = pickN(pool(p, ['legs', 'core']).filter((e) => e.equip === 'none'), 3, r);
    for (let i = 0; i < climbs; i++) {
      steps.push({ name: 'Climb', seconds: 90, kind: 'work', cue: `Climb ${i + 1} of ${climbs}. Steady, use every step.` });
      steps.push({ name: 'Walk down', seconds: 75, kind: 'rest', cue: 'Hold the rail. Shake out your legs.' });
      if (i % 2 === 1 && extras.length) {
        const e = extras[(i >> 1) % extras.length];
        steps.push({ ...work(e, 40), cue: 'At the bottom of the stairs' });
      }
    }
    steps.push(...coolDown(r, 3));
    const place = pickN(PLACES.filter((x) => x.for.includes('stairs')), 1, r)[0];
    return { ...base, outdoor: true, logKind: 'stairs', steps, minutes: minutesOf(steps), place };
  }

  if (type === 'dance') {
    const songs = 4 + Math.round(d * 2);
    const steps: Step[] = [...warmUp().slice(0, 4)];
    for (let i = 0; i < songs; i++) {
      steps.push({ name: i % 2 ? 'Full run through' : 'Practise the tricky part', seconds: 240, kind: 'work', cue: `Song ${i + 1} of ${songs}. Play your first dance song.` });
      if (i < songs - 1) steps.push({ name: 'Breather', seconds: 60, kind: 'rest', cue: 'Talk through what to change.' });
    }
    steps.push(...coolDown(r, 2));
    return { ...base, partner: true, logKind: 'dance', steps, minutes: minutesOf(steps) };
  }

  // Ten minute floor: one minute warm up, eight easy intervals, a short stretch.
  const moves = pickN([...pool(p, 'legs'), ...pool(p, 'cardio'), ...pool(p, 'core')].filter((e) => e.impact !== 'high'), 4, r);
  const steps: Step[] = [{ name: 'March on the spot', seconds: 60, kind: 'warm', exId: 'march' }];
  for (let i = 0; i < 8; i++) {
    steps.push(work(moves[i % moves.length], 40));
    if (i < 7) steps.push(rest(20, moves[(i + 1) % moves.length]));
  }
  steps.push(...coolDown(r, 2));
  return { ...base, steps, minutes: minutesOf(steps), note: 'Ten minutes is a win. Keep going if you feel good.' };
}

// Monday to Sunday rhythm, with Thursday and Sunday kept light.
const WEEK: SessionType[] = ['strength', 'walk', 'hiit', 'stretch', 'partner', 'stairs', 'dance'];
const INDOOR_SWAP: Partial<Record<SessionType, SessionType>> = { walk: 'tabata', stairs: 'strength' };

export function dayType(date: string): SessionType {
  const [y, m, dd] = date.split('-').map(Number);
  const dow = (new Date(y, m - 1, dd).getDay() + 6) % 7;
  return WEEK[dow];
}

/** Today's planned session, swapped indoors when the weather is bad. */
export function todaysSession(p: PlanInput): { session: Session; swapped: string | null } {
  const planned = dayType(p.date);
  const w = p.weather;
  let type = planned;
  let swapped: string | null = null;
  if (w && (planned === 'walk' || planned === 'stairs') && (w.rainChance >= 60 || w.maxTemp >= 34)) {
    type = INDOOR_SWAP[planned]!;
    swapped = w.rainChance >= 60 ? `Rain is likely today (${w.rainChance}%), so this moved indoors.` : `${w.maxTemp}°C forecast, so this moved indoors.`;
  }
  const session = buildSession(type, p);
  if (session.outdoor && w && w.maxTemp >= 28) {
    session.note = `${w.maxTemp}°C later today. Go before 8am or after 5pm, and take water.`;
  }
  return { session, swapped };
}

export const ALL_TYPES: SessionType[] = ['strength', 'hiit', 'tabata', 'partner', 'walk', 'stairs', 'stretch', 'dance', 'quick'];
