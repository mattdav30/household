// The full exercise list for building your own workouts: gym lifts, machines, cables, cardio machines,
// plus every home move from the guided workouts. Each one says how it is logged.
//   weight:   kilograms and reps per set
//   reps:     reps per set (bodyweight)
//   time:     seconds per set (holds, stretches, intervals)
//   cardio:   minutes and distance (machines, runs)
import { EXERCISES as HOME } from './exercises';

export type Track = 'weight' | 'reps' | 'time' | 'cardio';
export type Group = 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Forearms' | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core' | 'Full body' | 'Cardio' | 'Mobility';
export type Move = { id: string; name: string; group: Group; equip: string; track: Track; home?: boolean };

export const GROUPS: Group[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full body', 'Cardio', 'Mobility'];

// name | group | equipment | track
const GYM = `
Bench press|Chest|Barbell|weight
Incline bench press|Chest|Barbell|weight
Decline bench press|Chest|Barbell|weight
Close grip bench press|Triceps|Barbell|weight
Dumbbell bench press|Chest|Dumbbell|weight
Incline dumbbell press|Chest|Dumbbell|weight
Decline dumbbell press|Chest|Dumbbell|weight
Dumbbell fly|Chest|Dumbbell|weight
Incline dumbbell fly|Chest|Dumbbell|weight
Dumbbell pullover|Chest|Dumbbell|weight
Smith machine bench press|Chest|Smith machine|weight
Smith machine incline press|Chest|Smith machine|weight
Chest press machine|Chest|Machine|weight
Incline chest press machine|Chest|Machine|weight
Pec deck|Chest|Machine|weight
Cable fly|Chest|Cable|weight
Low to high cable fly|Chest|Cable|weight
High to low cable fly|Chest|Cable|weight
Cable crossover|Chest|Cable|weight
Chest dips|Chest|Bodyweight|reps
Weighted dips|Chest|Dip belt|weight
Assisted dips|Triceps|Machine|weight
Push ups|Chest|Bodyweight|reps
Weighted push ups|Chest|Plate|weight
Deadlift|Back|Barbell|weight
Sumo deadlift|Back|Barbell|weight
Trap bar deadlift|Back|Trap bar|weight
Rack pull|Back|Barbell|weight
Barbell row|Back|Barbell|weight
Pendlay row|Back|Barbell|weight
T bar row|Back|T bar|weight
Dumbbell row|Back|Dumbbell|weight
Chest supported dumbbell row|Back|Dumbbell|weight
Seal row|Back|Barbell|weight
Seated cable row|Back|Cable|weight
Single arm cable row|Back|Cable|weight
Lat pulldown|Back|Cable|weight
Close grip lat pulldown|Back|Cable|weight
Single arm lat pulldown|Back|Cable|weight
Straight arm pulldown|Back|Cable|weight
Machine row|Back|Machine|weight
Machine lat pulldown|Back|Machine|weight
Pull ups|Back|Bodyweight|reps
Chin ups|Back|Bodyweight|reps
Weighted pull ups|Back|Dip belt|weight
Assisted pull ups|Back|Machine|weight
Inverted row|Back|Bodyweight|reps
Back extension|Back|Bench|reps
Weighted back extension|Back|Plate|weight
Good morning|Hamstrings|Barbell|weight
Shrugs|Back|Barbell|weight
Dumbbell shrugs|Back|Dumbbell|weight
Overhead press|Shoulders|Barbell|weight
Push press|Shoulders|Barbell|weight
Seated dumbbell shoulder press|Shoulders|Dumbbell|weight
Standing dumbbell shoulder press|Shoulders|Dumbbell|weight
Arnold press|Shoulders|Dumbbell|weight
Shoulder press machine|Shoulders|Machine|weight
Smith machine shoulder press|Shoulders|Smith machine|weight
Lateral raise|Shoulders|Dumbbell|weight
Cable lateral raise|Shoulders|Cable|weight
Machine lateral raise|Shoulders|Machine|weight
Front raise|Shoulders|Dumbbell|weight
Plate front raise|Shoulders|Plate|weight
Rear delt fly|Shoulders|Dumbbell|weight
Reverse pec deck|Shoulders|Machine|weight
Face pull|Shoulders|Cable|weight
Upright row|Shoulders|Barbell|weight
Cable upright row|Shoulders|Cable|weight
Landmine press|Shoulders|Landmine|weight
Barbell curl|Biceps|Barbell|weight
EZ bar curl|Biceps|EZ bar|weight
Dumbbell curl|Biceps|Dumbbell|weight
Hammer curl|Biceps|Dumbbell|weight
Incline dumbbell curl|Biceps|Dumbbell|weight
Concentration curl|Biceps|Dumbbell|weight
Preacher curl|Biceps|EZ bar|weight
Machine preacher curl|Biceps|Machine|weight
Cable curl|Biceps|Cable|weight
Rope hammer curl|Biceps|Cable|weight
Bayesian cable curl|Biceps|Cable|weight
Spider curl|Biceps|Dumbbell|weight
Reverse curl|Forearms|EZ bar|weight
Wrist curl|Forearms|Dumbbell|weight
Reverse wrist curl|Forearms|Dumbbell|weight
Farmer's carry|Forearms|Dumbbell|weight
Dead hang|Forearms|Bodyweight|time
Tricep pushdown|Triceps|Cable|weight
Rope pushdown|Triceps|Cable|weight
Overhead cable extension|Triceps|Cable|weight
Single arm cable pushdown|Triceps|Cable|weight
Skull crushers|Triceps|EZ bar|weight
Dumbbell skull crushers|Triceps|Dumbbell|weight
Overhead dumbbell extension|Triceps|Dumbbell|weight
Tricep kickback|Triceps|Dumbbell|weight
Tricep dips|Triceps|Bodyweight|reps
Bench dips|Triceps|Bench|reps
Tricep extension machine|Triceps|Machine|weight
JM press|Triceps|Barbell|weight
Back squat|Quads|Barbell|weight
Front squat|Quads|Barbell|weight
Box squat|Quads|Barbell|weight
Pause squat|Quads|Barbell|weight
Smith machine squat|Quads|Smith machine|weight
Hack squat|Quads|Machine|weight
Leg press|Quads|Machine|weight
Single leg press|Quads|Machine|weight
Pendulum squat|Quads|Machine|weight
Belt squat|Quads|Machine|weight
Goblet squat|Quads|Dumbbell|weight
Kettlebell goblet squat|Quads|Kettlebell|weight
Bulgarian split squat|Quads|Dumbbell|weight
Barbell split squat|Quads|Barbell|weight
Walking lunges|Quads|Dumbbell|weight
Barbell lunges|Quads|Barbell|weight
Reverse lunges with dumbbells|Quads|Dumbbell|weight
Step ups with dumbbells|Quads|Dumbbell|weight
Leg extension|Quads|Machine|weight
Sissy squat|Quads|Bodyweight|reps
Romanian deadlift|Hamstrings|Barbell|weight
Dumbbell Romanian deadlift|Hamstrings|Dumbbell|weight
Single leg Romanian deadlift|Hamstrings|Dumbbell|weight
Stiff leg deadlift|Hamstrings|Barbell|weight
Lying leg curl|Hamstrings|Machine|weight
Seated leg curl|Hamstrings|Machine|weight
Standing leg curl|Hamstrings|Machine|weight
Nordic curl|Hamstrings|Bodyweight|reps
Glute ham raise|Hamstrings|Bench|reps
Kettlebell swing|Hamstrings|Kettlebell|weight
Hip thrust|Glutes|Barbell|weight
Machine hip thrust|Glutes|Machine|weight
Smith machine hip thrust|Glutes|Smith machine|weight
Single leg hip thrust|Glutes|Bodyweight|reps
Barbell glute bridge|Glutes|Barbell|weight
Cable kickback|Glutes|Cable|weight
Glute kickback machine|Glutes|Machine|weight
Hip abduction machine|Glutes|Machine|weight
Hip adduction machine|Quads|Machine|weight
Cable pull through|Glutes|Cable|weight
Frog pumps|Glutes|Bodyweight|reps
Banded lateral walk|Glutes|Band|reps
Standing calf raise|Calves|Machine|weight
Seated calf raise|Calves|Machine|weight
Leg press calf raise|Calves|Machine|weight
Smith machine calf raise|Calves|Smith machine|weight
Single leg calf raise|Calves|Dumbbell|weight
Plank|Core|Bodyweight|time
Side plank|Core|Bodyweight|time
Weighted plank|Core|Plate|time
Hanging leg raise|Core|Bodyweight|reps
Hanging knee raise|Core|Bodyweight|reps
Captain's chair leg raise|Core|Machine|reps
Cable crunch|Core|Cable|weight
Ab crunch machine|Core|Machine|weight
Decline sit ups|Core|Bench|reps
Weighted sit ups|Core|Plate|weight
Ab wheel rollout|Core|Ab wheel|reps
Russian twist|Core|Plate|weight
Pallof press|Core|Cable|weight
Woodchopper|Core|Cable|weight
Hollow hold|Core|Bodyweight|time
L sit|Core|Bodyweight|time
Suitcase carry|Core|Dumbbell|weight
Landmine rotation|Core|Landmine|weight
Power clean|Full body|Barbell|weight
Hang clean|Full body|Barbell|weight
Clean and jerk|Full body|Barbell|weight
Snatch|Full body|Barbell|weight
Thruster|Full body|Barbell|weight
Dumbbell thruster|Full body|Dumbbell|weight
Clean and press|Full body|Dumbbell|weight
Turkish get up|Full body|Kettlebell|weight
Kettlebell clean and press|Full body|Kettlebell|weight
Kettlebell snatch|Full body|Kettlebell|weight
Man makers|Full body|Dumbbell|weight
Sled push|Full body|Sled|weight
Sled pull|Full body|Sled|weight
Battle ropes|Full body|Battle ropes|time
Wall balls|Full body|Medicine ball|weight
Medicine ball slam|Full body|Medicine ball|weight
Box jumps|Full body|Box|reps
Burpee box jump overs|Full body|Box|reps
Treadmill run|Cardio|Treadmill|cardio
Treadmill walk|Cardio|Treadmill|cardio
Incline treadmill walk|Cardio|Treadmill|cardio
Exercise bike|Cardio|Bike|cardio
Spin bike|Cardio|Bike|cardio
Assault bike|Cardio|Bike|cardio
Rowing machine|Cardio|Rower|cardio
Elliptical|Cardio|Elliptical|cardio
Stair climber|Cardio|Stair machine|cardio
Ski erg|Cardio|Ski erg|cardio
Swimming|Cardio|Pool|cardio
Outdoor run|Cardio|None|cardio
Outdoor walk|Cardio|None|cardio
Cycling|Cardio|Bike|cardio
Hiking|Cardio|None|cardio
Jump rope|Cardio|Skipping rope|time
Foam rolling|Mobility|Foam roller|time
Hip flexor stretch|Mobility|Bodyweight|time
Hamstring stretch|Mobility|Bodyweight|time
Pigeon stretch|Mobility|Mat|time
Couch stretch|Mobility|Bodyweight|time
Chest doorway stretch|Mobility|Bodyweight|time
Lat stretch|Mobility|Bodyweight|time
Thoracic rotations|Mobility|Mat|reps
Cat cow|Mobility|Mat|reps
World's greatest stretch|Mobility|Bodyweight|reps
`;

const slug = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const AREA_GROUP: Record<string, Group> = { legs: 'Quads', push: 'Chest', pull: 'Back', core: 'Core', cardio: 'Cardio', mobility: 'Mobility', warm: 'Mobility' };
const EQUIP_LABEL: Record<string, string> = {
  none: 'Bodyweight', mat: 'Mat', chair: 'Chair', stairs: 'Stairs', dumbbells: 'Dumbbell', bands: 'Band', kettlebell: 'Kettlebell', rope: 'Skipping rope', backpack: 'Backpack',
};

const gym: Move[] = GYM.trim().split('\n').map((line) => {
  const [name, group, equip, track] = line.split('|');
  return { id: `g-${slug(name)}`, name, group: group as Group, equip, track: track as Track };
});
const home: Move[] = HOME.map((e) => ({
  id: `h-${e.id}`,
  name: e.name,
  group: AREA_GROUP[e.area] ?? 'Full body',
  equip: EQUIP_LABEL[e.equip] ?? 'Bodyweight',
  track: (['dumbbells', 'kettlebell', 'backpack'].includes(e.equip) ? 'weight' : ['cardio', 'mobility', 'warm'].includes(e.area) || e.yoga ? 'time' : 'reps') as Track,
  home: true,
}));

/** Every exercise, gym first, home moves after, without repeating a name. */
export const MOVES: Move[] = (() => {
  const seen = new Set<string>();
  return [...gym, ...home].filter((m) => { const k = m.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
})();
const BY_ID = new Map(MOVES.map((m) => [m.id, m]));

/** Your own exercise, made up on the spot when it is missing from the list. */
export const customMove = (name: string, track: Track = 'weight'): Move => ({ id: `c-${slug(name)}`, name: name.trim(), group: 'Full body', equip: 'Your own', track });
export const moveById = (id: string, fallbackName?: string, fallbackTrack?: Track): Move =>
  BY_ID.get(id) ?? customMove(fallbackName ?? id.replace(/^c-/, '').replace(/-/g, ' '), fallbackTrack ?? 'weight');

/** Search by any words in the name, group or equipment, best matches first. */
export function searchMoves(q: string, group: Group | null, extra: Move[] = []): Move[] {
  const ALIAS: Record<string, string> = { db: 'dumbbell', bb: 'barbell', kb: 'kettlebell', rdl: 'romanian', ohp: 'overhead', abs: 'core', legs: 'quads' };
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => ALIAS[w] ?? w);
  const pool = [...extra.filter((e) => !BY_ID.has(e.id)), ...MOVES].filter((m) => !group || m.group === group);
  if (!words.length) return pool;
  const scored = pool.map((m) => {
    const hay = `${m.name} ${m.group} ${m.equip}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return null;
    const name = m.name.toLowerCase();
    const score = (name.startsWith(words[0]) ? 0 : name.includes(words[0]) ? 1 : 2) + (m.home ? 0.5 : 0);
    return { m, score };
  }).filter(Boolean) as { m: Move; score: number }[];
  return scored.sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name)).map((s) => s.m);
}

/** Estimated one rep max (Epley), the usual way to compare sets of different reps. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));
export const fmtKg = (kg: number) => `${Math.round(kg * 10) / 10}`;
export function fmtSecs(s: number) {
  const m = Math.floor(s / 60);
  return m ? `${m}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)}s`;
}
