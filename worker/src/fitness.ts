// Tandem: the fitness side of the API. Same accounts and households as Household,
// mounted under /api/fit so the generic list routes never see these paths.
// The app is a simple tracker with a shared pet. Each person climbs a ladder of small steps,
// starting from a ten minute walk.
import type { Hono } from 'hono';
import { addDays, localDate, now, uid } from './lib';

type Env = { DB: D1Database; TZ_OFFSET_MIN: string };
type User = { id: string; household_id: string; email: string; name: string; color: string };
type App = Hono<{ Bindings: Env; Variables: { user: User } }>;

const bad = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { 'content-type': 'application/json' },
});
const tz = (env: Env) => Number(env.TZ_OFFSET_MIN ?? 600);

/** Ten minutes of anything feeds the pet and keeps a streak alive. */
export const FLOOR_MIN = 10;
const SHIELDS_PER_MONTH = 2;
export const KINDS = ['home', 'walk', 'jog', 'stairs', 'partner', 'dance', 'stretch', 'outdoor', 'sport', 'other'] as const;

/** The ladder. Everyone starts where they are comfortable and climbs one step at a time. */
export const STEPS = [
  { step: 1, target: 10, title: 'Ten minute walk', tip: 'Any walk counts. Around the block is perfect.' },
  { step: 2, target: 15, title: 'Fifteen minute walk', tip: 'Same walk, a few minutes longer.' },
  { step: 3, target: 20, title: 'Twenty minute walk', tip: 'Add a couple of faster bursts if you feel good.' },
  { step: 4, target: 20, title: 'Brisk walks', tip: 'Walk like you are running late. Try the ten minute home workout once a week.' },
  { step: 5, target: 25, title: 'Walks and home workouts', tip: 'Two short home workouts a week, walks on the other days.' },
  { step: 6, target: 30, title: 'Thirty minutes', tip: 'Mix walks with home workouts. Add stairs once a week.' },
  { step: 7, target: 30, title: 'Walk jog', tip: 'Try walk jog intervals or a full home workout.' },
  { step: 8, target: 40, title: 'All in', tip: 'Forty minutes of anything. You built this.' },
];
const stepOf = (n: number) => STEPS[Math.min(STEPS.length, Math.max(1, n)) - 1];
/** Hit your step on this many of the last seven days and the app offers the next one. */
const STEP_UP_DAYS = 5;

/** The dog grows with every day either of you moves. Each stage adds a look and a new trick. */
const STAGES = [
  { at: 0, name: 'Newborn', look: 'Tiny and sleepy', trick: null },
  { at: 5, name: 'Puppy', look: 'Bigger paws', trick: 'sit' },
  { at: 15, name: 'Bandana Pup', look: 'A red bandana', trick: 'paw' },
  { at: 30, name: 'Collar Pup', look: 'Collar with a heart tag', trick: 'spin' },
  { at: 50, name: 'Playful Pup', look: 'Fluffier tail and ears', trick: 'roll' },
  { at: 80, name: 'Grown Up', look: 'Emerald scarf', trick: 'bow' },
  { at: 120, name: 'Good Dog', look: 'Gold medal', trick: 'beg' },
  { at: 180, name: 'Champion', look: 'Hero cape', trick: 'zoomies' },
  { at: 270, name: 'Legend', look: 'Golden crown and sparkle', trick: 'dance' },
];

/** Things to wear, bought with treats. */
const WARDROBE: Record<string, { name: string; cost: number }> = {
  party: { name: 'Party hat', cost: 8 },
  bow: { name: 'Bow', cost: 10 },
  glasses: { name: 'Sunglasses', cost: 12 },
  beanie: { name: 'Beanie', cost: 15 },
  flowers: { name: 'Flower crown', cost: 20 },
  cap: { name: 'Cap', cost: 15 },
  bowtie: { name: 'Bow tie', cost: 25 },
  veil: { name: 'Wedding veil', cost: 40 },
};
const TREATS_PER_SESSION = 6;
/** The play meter drops two points an hour, so a full meter lasts about two days. */
const FUN_DECAY_PER_HOUR = 2;

type PetRow = {
  household_id: string; treats_spent: number; fun: number; fun_at: number; owned: string; wearing: string | null;
  best_fetch: number; best_catch: number; best_find: number;
  food: number; food_at: number; energy: number; energy_at: number; nap_until: number; clean: number; clean_at: number; mess_at: number;
};
async function petRow(env: Env, householdId: string): Promise<PetRow> {
  const r = await env.DB.prepare('SELECT * FROM fit_pet WHERE household_id = ?').bind(householdId).first<PetRow>();
  if (r) return r;
  const t = now();
  await env.DB.prepare('INSERT OR IGNORE INTO fit_pet (household_id, fun_at, food_at, energy_at, clean_at, mess_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(householdId, t, t, t, t, t, t).run();
  return (await env.DB.prepare('SELECT * FROM fit_pet WHERE household_id = ?').bind(householdId).first<PetRow>())!;
}
const funNow = (r: PetRow) => Math.max(0, Math.round(r.fun - ((now() - r.fun_at) / 3600000) * FUN_DECAY_PER_HOUR));

// The dog's needs, Tamagotchi style. Moving is the only way to fill the food bowl.
const HOUR = 3600000;
export const NEEDS = {
  foodPerHour: 3, // a full bowl lasts about a day and a half
  foodPerMinute: 3.5, // ten minutes of moving is about a third of a bowl, thirty minutes fills it
  treatFood: 6,
  cleanPerHour: 1.5, // about three days between baths
  muddyPerOutdoor: 8, // walks and runs bring back muddy paws
  energyDayPerHour: 2.5,
  energyNightPerHour: 12, // 10pm to 6am, the dog sleeps and recharges
  energyNapPerHour: 70, // a thirty minute nap adds 35
  napMinutes: 30,
  gameEnergy: 8,
  messEveryHours: 7,
  messMax: 3,
  sickAfterHours: 12, // an empty bowl or a filthy coat for this long makes the dog poorly
};
const OUTDOOR = new Set(['walk', 'jog', 'outdoor', 'sport', 'stairs']);
const clamp = (x: number) => Math.max(0, Math.min(100, x));
const foodNow = (r: PetRow, t = now()) => clamp(r.food - ((t - r.food_at) / HOUR) * NEEDS.foodPerHour);
const cleanNow = (r: PetRow, t = now()) => clamp(r.clean - ((t - r.clean_at) / HOUR) * NEEDS.cleanPerHour);
const messNow = (r: PetRow, t = now()) => Math.min(NEEDS.messMax, Math.max(0, Math.floor((t - r.mess_at) / (NEEDS.messEveryHours * HOUR))));
/** Energy falls in the day and climbs back overnight and during naps, so it is stepped through in ten minute slices. */
function energyNow(r: PetRow, tzMin: number, t = now()) {
  const step = 10 * 60000;
  let e = r.energy;
  for (let x = Math.max(r.energy_at, t - 7 * 24 * HOUR); x < t; x += step) {
    const span = Math.min(step, t - x) / HOUR;
    const hour = Math.floor(((x + tzMin * 60000) / HOUR) % 24);
    const rate = x < r.nap_until ? NEEDS.energyNapPerHour : hour >= 22 || hour < 6 ? NEEDS.energyNightPerHour : -NEEDS.energyDayPerHour;
    e = clamp(e + rate * span);
  }
  return e;
}
/** Why the dog is poorly, if it is: the bowl or the coat has been at zero for half a day. */
function sickNow(r: PetRow, t = now()): null | 'hungry' | 'dirty' {
  const foodZero = r.food_at + (r.food / NEEDS.foodPerHour) * HOUR;
  if (t - foodZero >= NEEDS.sickAfterHours * HOUR) return 'hungry';
  const cleanZero = r.clean_at + (r.clean / NEEDS.cleanPerHour) * HOUR;
  if (t - cleanZero >= NEEDS.sickAfterHours * HOUR) return 'dirty';
  return null;
}
function needsOf(r: PetRow, tzMin: number) {
  const t = now();
  const food = Math.round(foodNow(r, t));
  const energy = Math.round(energyNow(r, tzMin, t));
  const clean = Math.round(cleanNow(r, t));
  const fun = funNow(r);
  const mess = messNow(r, t);
  const sick = sickNow(r, t);
  let wellbeing = Math.round(clamp((food + energy + clean + fun) / 4 - mess * 6));
  if (sick) wellbeing = Math.min(wellbeing, 20);
  return {
    food, energy, clean, fun, mess, sick, wellbeing,
    napping: t < r.nap_until, nap_ends: t < r.nap_until ? r.nap_until : null,
    // When the bowl drops below a quarter, for the hungry reminder.
    hungry_at: food > 25 ? Math.round(t + ((food - 25) / NEEDS.foodPerHour) * HOUR) : t,
  };
}

/** Logging movement fills the bowl, lifts the play meter, and outdoor sessions bring back muddy paws. */
async function feedFromWorkouts(env: Env, householdId: string, sessions: { minutes: number; kind: string }[]) {
  if (!sessions.length) return;
  const r = await petRow(env, householdId);
  const t = now();
  const minutes = sessions.reduce((a, x) => a + x.minutes, 0);
  const outdoor = sessions.filter((x) => OUTDOOR.has(x.kind)).length;
  const food = clamp(foodNow(r, t) + minutes * NEEDS.foodPerMinute);
  const clean = clamp(cleanNow(r, t) - outdoor * NEEDS.muddyPerOutdoor);
  const fun = Math.min(100, funNow(r) + 5 * sessions.length);
  await env.DB.prepare('UPDATE fit_pet SET food = ?, food_at = ?, clean = ?, clean_at = ?, fun = ?, fun_at = ?, updated_at = ? WHERE household_id = ?')
    .bind(food, t, clean, t, fun, t, t, householdId).run();
}

const BADGES: { id: string; title: string; desc: string; icon: string }[] = [
  { id: 'first', title: 'First steps', desc: 'Moved for ten minutes', icon: 'shoe-print' },
  { id: 'ten', title: 'Ten days', desc: 'Ten days of moving', icon: 'numeric-10-circle' },
  { id: 'week', title: 'Full week', desc: 'A seven day streak', icon: 'calendar-check' },
  { id: 'together', title: 'Side by side', desc: 'Five sessions together', icon: 'account-heart' },
  { id: 'stepup', title: 'Stepping up', desc: 'Reached step three', icon: 'stairs-up' },
  { id: 'beyond', title: 'Beyond the walk', desc: 'First home workout', icon: 'arm-flex' },
  { id: 'month', title: 'Thirty days', desc: 'Thirty days of moving', icon: 'medal' },
  { id: 'fortnight', title: 'Two weeks straight', desc: 'A fourteen day streak', icon: 'fire' },
  { id: 'fifty', title: 'Fifty days', desc: 'Fifty days of moving', icon: 'star-circle' },
  { id: 'hundred', title: 'Hundred club', desc: 'A hundred days of moving', icon: 'trophy' },
];

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
/** Monday of the week holding this date. */
export function weekStart(date: string) {
  const dow = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

type Settings = {
  household_id: string; start_date: string; wedding_date: string; equipment: string; countdown_label: string;
  pet_name: string | null; pet_kind: string; pet_color: string;
};
type Profile = { user_id: string; level: number; reminder_hour: number | null; step: number; step_since: string | null; evening_nudge: number };
type Workout = {
  id: string; user_id: string; group_id: string | null; date: string; minutes: number; kind: string; title: string;
  effort: number; together: number; notes: string | null; created_at: number;
};

async function getSettings(env: Env, householdId: string): Promise<Settings> {
  const s = await env.DB.prepare('SELECT * FROM fit_settings WHERE household_id = ?').bind(householdId).first<Settings>();
  if (s) return s;
  const start = weekStart(localDate(tz(env)));
  await env.DB.prepare('INSERT OR IGNORE INTO fit_settings (household_id, start_date, updated_at) VALUES (?, ?, ?)')
    .bind(householdId, start, now()).run();
  return (await env.DB.prepare('SELECT * FROM fit_settings WHERE household_id = ?').bind(householdId).first<Settings>())!;
}

/** Days in a row with at least FLOOR_MIN minutes. Missed days use up to two shields a month before the streak resets. */
function streakFor(daily: Map<string, number>, from: string, today: string) {
  let days = 0;
  let best = 0;
  const used: Record<string, number> = {};
  for (let d = from; d < today; d = addDays(d, 1)) {
    const month = d.slice(0, 7);
    if ((daily.get(d) ?? 0) >= FLOOR_MIN) days++;
    else if (days > 0 && (used[month] ?? 0) < SHIELDS_PER_MONTH) used[month] = (used[month] ?? 0) + 1;
    else days = 0;
    best = Math.max(best, days);
  }
  const doneToday = (daily.get(today) ?? 0) >= FLOOR_MIN;
  if (doneToday) days++;
  return { days, best: Math.max(best, days), done_today: doneToday, shields_left: SHIELDS_PER_MONTH - (used[today.slice(0, 7)] ?? 0) };
}

async function summary(env: Env, u: User) {
  const today = localDate(tz(env));
  const s = await getSettings(env, u.household_id);
  // Two years of daily totals covers streaks and charts without loading every workout ever logged.
  const since = addDays(today, -730) > s.start_date ? addDays(today, -730) : s.start_date;
  const pr = await petRow(env, u.household_id);
  const [members, profiles, daysQ, recentQ, kindsQ, treatsQ] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, color FROM users WHERE household_id = ? ORDER BY created_at').bind(u.household_id),
    env.DB.prepare('SELECT p.* FROM fit_profiles p JOIN users u ON u.id = p.user_id WHERE u.household_id = ?').bind(u.household_id),
    env.DB.prepare('SELECT user_id, date, SUM(minutes) AS m FROM fit_workouts WHERE household_id = ? AND date >= ? GROUP BY user_id, date').bind(u.household_id, since),
    env.DB.prepare('SELECT * FROM fit_workouts WHERE household_id = ? ORDER BY date DESC, created_at DESC LIMIT 12').bind(u.household_id),
    env.DB.prepare(`SELECT user_id, SUM(together) AS together, SUM(CASE WHEN kind IN ('home', 'partner', 'stairs', 'jog') THEN 1 ELSE 0 END) AS workouts
      FROM fit_workouts WHERE household_id = ? GROUP BY user_id`).bind(u.household_id),
    env.DB.prepare(`SELECT COALESCE(SUM(MIN(minutes / 10, ${TREATS_PER_SESSION})), 0) AS t FROM fit_workouts WHERE household_id = ?`).bind(u.household_id),
  ]);
  const treatsEarned = (treatsQ.results[0] as { t: number }).t;
  const people = members.results as { id: string; name: string; color: string }[];
  const prof = new Map((profiles.results as Profile[]).map((p) => [p.user_id, p]));
  const kinds = new Map((kindsQ.results as { user_id: string; together: number; workouts: number }[]).map((k) => [k.user_id, k]));

  // Minutes per person per day.
  const daily = new Map<string, Map<string, number>>(people.map((p) => [p.id, new Map()]));
  for (const r of daysQ.results as { user_id: string; date: string; m: number }[]) daily.get(r.user_id)?.set(r.date, r.m);
  const minutesOn = (id: string, d: string) => daily.get(id)?.get(d) ?? 0;
  const sumRange = (id: string, from: string, to: string) => {
    let t = 0;
    for (const [d, m] of daily.get(id) ?? []) if (d >= from && d <= to) t += m;
    return t;
  };
  const activeDays = (id: string) => {
    let n = 0;
    for (const [d, m] of daily.get(id) ?? []) if (d >= s.start_date && d <= today && m >= FLOOR_MIN) n++;
    return n;
  };

  // This week, Monday to Sunday, and the last eight weeks for the chart.
  const ws = weekStart(today);
  const weekBy: Record<string, number> = {};
  for (const p of people) weekBy[p.id] = sumRange(p.id, ws, addDays(ws, 6));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    return { date: d, by_user: Object.fromEntries(people.map((p) => [p.id, minutesOn(p.id, d)])) };
  });
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(ws, -7 * (7 - i));
    return { start, by_user: Object.fromEntries(people.map((p) => [p.id, sumRange(p.id, start, addDays(start, 6))])) };
  });

  const streaks = Object.fromEntries(people.map((p) => [p.id, streakFor(daily.get(p.id)!, since, today)]));

  // Each person's step, and whether they are ready for the next one.
  const memberRows = people.map((p) => {
    const pr = prof.get(p.id);
    const st = stepOf(pr?.step ?? 1);
    const stepSince = pr?.step_since ?? s.start_date;
    const windowStart = addDays(today, -6) > stepSince ? addDays(today, -6) : stepSince;
    let hits = 0;
    for (let d = windowStart; d <= today; d = addDays(d, 1)) if (minutesOn(p.id, d) >= st.target) hits++;
    return {
      ...p,
      level: pr?.level ?? 1,
      reminder_hour: pr ? pr.reminder_hour : 7,
      evening_nudge: pr ? !!pr.evening_nudge : true,
      step: st.step,
      target: st.target,
      step_since: stepSince,
      hits_7: hits,
      can_step_up: st.step < STEPS.length && hits >= STEP_UP_DAYS,
      today_minutes: minutesOn(p.id, today),
      active_days: activeDays(p.id),
    };
  });

  // The pet: fed by anyone who moves ten minutes today, happier the more you both moved lately.
  const weights = [1, 0.6, 0.3];
  let score = 0;
  for (const p of people) weights.forEach((w, i) => { if (minutesOn(p.id, addDays(today, -i)) >= FLOOR_MIN) score += w; });
  const maxScore = weights.reduce((a, b) => a + b, 0) * Math.max(1, people.length);
  const ratio = score / maxScore;
  const anyEver = memberRows.some((m) => m.active_days > 0);
  const needs = needsOf(pr, tz(env));
  // Moving sets the mood. Neglected needs pull it down a notch, and a poorly dog is sad until it is looked after.
  const LADDER = ['sad', 'okay', 'happy', 'thrilled'] as const;
  let moodAt = ratio >= 0.75 ? 3 : ratio >= 0.45 ? 2 : ratio >= 0.2 ? 1 : 0;
  if (needs.wellbeing < 35) moodAt = Math.max(0, moodAt - 1);
  if (needs.sick) moodAt = 0;
  const mood = !anyEver && !needs.sick ? 'new' : LADDER[moodAt];
  const growth = memberRows.reduce((a, m) => a + m.active_days, 0);
  let stage = 0;
  STAGES.forEach((st, i) => { if (growth >= st.at) stage = i; });
  const nextStage = STAGES[stage + 1] ?? null;

  // Badges for whoever is asking.
  const me = memberRows.find((m) => m.id === u.id)!;
  const myStreak = streaks[u.id];
  const earned = new Set<string>();
  if (me.active_days >= 1) earned.add('first');
  if (me.active_days >= 10) earned.add('ten');
  if (me.active_days >= 30) earned.add('month');
  if (me.active_days >= 50) earned.add('fifty');
  if (me.active_days >= 100) earned.add('hundred');
  if (myStreak.best >= 7) earned.add('week');
  if (myStreak.best >= 14) earned.add('fortnight');
  if ((kinds.get(u.id)?.together ?? 0) >= 5) earned.add('together');
  if ((kinds.get(u.id)?.workouts ?? 0) >= 1) earned.add('beyond');
  if (me.step >= 3) earned.add('stepup');

  return {
    today,
    me: u.id,
    settings: { ...s, equipment: JSON.parse((s.equipment as string) || '[]') as string[] },
    members: memberRows,
    steps: STEPS,
    countdown: { label: s.countdown_label, date: s.wedding_date, days: daysBetween(today, s.wedding_date) },
    week: { start: ws, by_user: weekBy, total: Object.values(weekBy).reduce((a, b) => a + b, 0), days: weekDays },
    weeks,
    streaks,
    pet: {
      name: s.pet_name, kind: s.pet_kind, color: s.pet_color, mood,
      fed: Object.fromEntries(people.map((p) => [p.id, minutesOn(p.id, today) >= FLOOR_MIN])),
      stage, stage_name: STAGES[stage].name, growth, next_stage_at: nextStage?.at ?? null,
      stages: STAGES.map((st, i) => ({ ...st, reached: i <= stage })),
      tricks: STAGES.slice(1, stage + 1).map((st) => st.trick).filter(Boolean),
      treats: Math.max(0, treatsEarned - pr.treats_spent),
      treats_earned: treatsEarned,
      fun: needs.fun,
      needs,
      age_days: Math.max(0, daysBetween(s.start_date, today)),
      owned: JSON.parse(pr.owned || '[]') as string[],
      wearing: pr.wearing,
      wardrobe: Object.entries(WARDROBE).map(([id, w]) => ({ id, ...w })),
      best: { fetch: pr.best_fetch, catch: pr.best_catch, find: pr.best_find },
    },
    badges: BADGES.map((b) => ({ ...b, earned: earned.has(b.id) })),
    recent: recentQ.results as Workout[],
  };
}

export function registerFitness(app: App) {
  app.get('/api/fit/summary', async (c) => c.json(await summary(c.env, c.get('user'))));

  // The newest installable build, so the app can offer an update without a trip to expo.dev.
  app.get('/api/fit/app-release', async (c) => {
    const r = await c.env.DB.prepare('SELECT version, url, notes FROM fit_app_release WHERE id = 1').first();
    return c.json(r ?? null);
  });

  app.get('/api/fit/workouts', async (c) => {
    const u = c.get('user');
    const before = c.req.query('before') ?? '9999-12-31';
    const rows = await c.env.DB.prepare('SELECT * FROM fit_workouts WHERE household_id = ? AND date < ? ORDER BY date DESC, created_at DESC LIMIT 60')
      .bind(u.household_id, before).all();
    return c.json(rows.results);
  });

  app.post('/api/fit/workouts', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ date?: string; minutes?: number; kind?: string; title?: string; effort?: number; together?: boolean; notes?: string }>();
    const minutes = Math.round(Number(b.minutes));
    if (!(minutes >= 1 && minutes <= 600)) return bad('Enter between 1 and 600 minutes.');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '') ? b.date! : localDate(tz(c.env));
    const kind = (KINDS as readonly string[]).includes(b.kind ?? '') ? b.kind! : 'other';
    const title = (b.title ?? '').trim() || 'Workout';
    const effort = Math.min(3, Math.max(1, Math.round(Number(b.effort) || 2)));
    const notes = (b.notes ?? '').trim() || null;
    const people = b.together
      ? ((await c.env.DB.prepare('SELECT id FROM users WHERE household_id = ?').bind(u.household_id).all<{ id: string }>()).results.map((r) => r.id))
      : [u.id];
    const group = people.length > 1 ? uid('g_') : null;
    const ids = people.map(() => uid('fw_'));
    await c.env.DB.batch(people.map((pid, i) => c.env.DB.prepare(
      'INSERT INTO fit_workouts (id, household_id, user_id, group_id, date, minutes, kind, title, effort, together, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(ids[i], u.household_id, pid, group, date, minutes, kind, title, effort, people.length > 1 ? 1 : 0, notes, now())));
    // Only today's sessions feed the dog, so back filling last week does not overfill the bowl.
    if (date === localDate(tz(c.env))) await feedFromWorkouts(c.env, u.household_id, people.map(() => ({ minutes, kind })));
    return c.json({ ids, summary: await summary(c.env, u) }, 201);
  });

  // Sessions read from Health Connect on the phone (Samsung Health and others). Each one imports once.
  app.post('/api/fit/import', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ sessions?: { external_id?: string; date?: string; minutes?: number; kind?: string; title?: string; source?: string; start_ms?: number; end_ms?: number }[] }>();
    const rows = (b.sessions ?? []).filter((x) => typeof x.external_id === 'string' && x.external_id.length <= 200
      && /^\d{4}-\d{2}-\d{2}$/.test(x.date ?? '') && Number(x.minutes) >= 1 && Number(x.minutes) <= 600).slice(0, 200);
    // Skip a session when the person already logged something by hand around the same time,
    // so a walk logged in Tandem and tracked by the watch counts once.
    const manual = (await c.env.DB.prepare('SELECT date, created_at FROM fit_workouts WHERE user_id = ? AND source IS NULL AND date >= ?')
      .bind(u.id, rows.reduce((m, x) => (x.date! < m ? x.date! : m), '9999-12-31')).all<{ date: string; created_at: number }>()).results;
    const fresh = rows.filter((x) => !(x.start_ms && x.end_ms && manual.some((m) => m.date === x.date
      && m.created_at >= x.start_ms! - 10 * 60000 && m.created_at <= x.end_ms! + 60 * 60000)));
    let added = 0;
    if (fresh.length) {
      const res = await c.env.DB.batch(fresh.map((x) => c.env.DB.prepare(
        `INSERT OR IGNORE INTO fit_workouts (id, household_id, user_id, group_id, date, minutes, kind, title, effort, together, notes, created_at, source, external_id)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 2, 0, NULL, ?, ?, ?)`,
      ).bind(uid('fw_'), u.household_id, u.id, x.date, Math.round(Number(x.minutes)),
        (KINDS as readonly string[]).includes(x.kind ?? '') ? x.kind : 'other', (x.title ?? '').trim().slice(0, 80) || 'Workout',
        now(), (x.source ?? 'health').slice(0, 40), x.external_id)));
      added = res.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
      const today = localDate(tz(c.env));
      const fed = fresh.filter((x, i) => res[i].meta.changes && x.date === today);
      await feedFromWorkouts(c.env, u.household_id, fed.map((x) => ({ minutes: Math.round(Number(x.minutes)), kind: x.kind ?? 'other' })));
    }
    return c.json({ added, summary: await summary(c.env, u) });
  });

  // Playing with the dog: pats, treats, tricks and minigames lift the play meter. Games tire the dog out a little.
  app.post('/api/fit/pet/play', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ kind?: string; score?: number }>();
    const r = await petRow(c.env, u.household_id);
    const score = Math.max(0, Math.min(100, Math.round(Number(b.score) || 0)));
    const gain: Record<string, number> = { pat: 2, trick: 4, treat: 12, fetch: 6 + score * 3, catch: 6 + Math.round(score / 2), find: 6 + score * 3 };
    if (!(b.kind && b.kind in gain)) return bad('Unknown kind of play.');
    const t = now();
    let spent = r.treats_spent;
    let food = foodNow(r, t);
    let energy = energyNow(r, tz(c.env), t);
    let napUntil = r.nap_until;
    if (b.kind === 'treat') {
      const earned = ((await c.env.DB.prepare(`SELECT COALESCE(SUM(MIN(minutes / 10, ${TREATS_PER_SESSION})), 0) AS t FROM fit_workouts WHERE household_id = ?`)
        .bind(u.household_id).first<{ t: number }>())?.t ?? 0);
      if (earned - spent < 1) return bad('No treats left. Every ten minutes of moving earns one.');
      spent += 1;
      food = clamp(food + NEEDS.treatFood);
      napUntil = Math.min(napUntil, t); // the smell of a treat wakes any dog
    }
    if (b.kind === 'fetch' || b.kind === 'catch' || b.kind === 'find') energy = clamp(energy - NEEDS.gameEnergy);
    if (b.kind === 'trick') energy = clamp(energy - 1);
    const fun = Math.min(100, funNow(r) + Math.min(30, gain[b.kind]));
    const best = { fetch: r.best_fetch, catch: r.best_catch, find: r.best_find } as Record<string, number>;
    if (b.kind in best) best[b.kind] = Math.max(best[b.kind], score);
    await c.env.DB.prepare(`UPDATE fit_pet SET fun = ?, fun_at = ?, treats_spent = ?, best_fetch = ?, best_catch = ?, best_find = ?,
      food = ?, food_at = ?, energy = ?, energy_at = ?, nap_until = ?, updated_at = ? WHERE household_id = ?`)
      .bind(fun, t, spent, best.fetch, best.catch, best.find, food, t, energy, t, napUntil, t, u.household_id).run();
    return c.json(await summary(c.env, u));
  });

  // Looking after the dog: naps, baths and scooping up after it.
  app.post('/api/fit/pet/care', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ action?: string }>();
    const r = await petRow(c.env, u.household_id);
    const t = now();
    const energy = energyNow(r, tz(c.env), t);
    switch (b.action) {
      case 'nap':
        if (t < r.nap_until) break;
        if (energy >= 95) return bad('Not sleepy yet. Too much energy for a nap.');
        await c.env.DB.prepare('UPDATE fit_pet SET energy = ?, energy_at = ?, nap_until = ?, updated_at = ? WHERE household_id = ?')
          .bind(energy, t, t + NEEDS.napMinutes * 60000, t, u.household_id).run();
        break;
      case 'wake':
        await c.env.DB.prepare('UPDATE fit_pet SET energy = ?, energy_at = ?, nap_until = ?, updated_at = ? WHERE household_id = ?')
          .bind(energy, t, Math.min(r.nap_until, t), t, u.household_id).run();
        break;
      case 'bath':
        // Baths are not every dog's favourite, but the towel zoomies after make up for it.
        await c.env.DB.prepare('UPDATE fit_pet SET clean = 100, clean_at = ?, fun = ?, fun_at = ?, updated_at = ? WHERE household_id = ?')
          .bind(t, Math.min(100, funNow(r) + 4), t, t, u.household_id).run();
        break;
      case 'scoop':
        if (!messNow(r, t)) break;
        // Keep the time already counted towards the next mess, so scooping never resets the clock to zero.
        await c.env.DB.prepare('UPDATE fit_pet SET mess_at = ?, updated_at = ? WHERE household_id = ?')
          .bind(t - ((t - r.mess_at) % (NEEDS.messEveryHours * HOUR)), t, u.household_id).run();
        break;
      default:
        return bad('Unknown care action.');
    }
    return c.json(await summary(c.env, u));
  });

  app.post('/api/fit/pet/buy', async (c) => {
    const u = c.get('user');
    const item = (await c.req.json<{ item?: string }>()).item ?? '';
    const w = WARDROBE[item];
    if (!w) return bad('Unknown item.');
    const r = await petRow(c.env, u.household_id);
    const owned = JSON.parse(r.owned || '[]') as string[];
    if (!owned.includes(item)) {
      const earned = ((await c.env.DB.prepare(`SELECT COALESCE(SUM(MIN(minutes / 10, ${TREATS_PER_SESSION})), 0) AS t FROM fit_workouts WHERE household_id = ?`)
        .bind(u.household_id).first<{ t: number }>())?.t ?? 0);
      if (earned - r.treats_spent < w.cost) return bad(`That needs ${w.cost} treats. Every ten minutes of moving earns one.`);
      owned.push(item);
      await c.env.DB.prepare('UPDATE fit_pet SET owned = ?, treats_spent = treats_spent + ?, wearing = ?, updated_at = ? WHERE household_id = ?')
        .bind(JSON.stringify(owned), w.cost, item, now(), u.household_id).run();
    }
    return c.json(await summary(c.env, u));
  });

  app.post('/api/fit/pet/wear', async (c) => {
    const u = c.get('user');
    const item = (await c.req.json<{ item?: string | null }>()).item ?? null;
    const r = await petRow(c.env, u.household_id);
    const owned = JSON.parse(r.owned || '[]') as string[];
    if (item && !owned.includes(item)) return bad('Buy it first.');
    await c.env.DB.prepare('UPDATE fit_pet SET wearing = ?, updated_at = ? WHERE household_id = ?').bind(item, now(), u.household_id).run();
    return c.json(await summary(c.env, u));
  });

  // Deleting one row of a shared session removes both people's rows.
  app.delete('/api/fit/workouts/:id', async (c) => {
    const u = c.get('user');
    const row = await c.env.DB.prepare('SELECT group_id FROM fit_workouts WHERE id = ? AND household_id = ?')
      .bind(c.req.param('id'), u.household_id).first<{ group_id: string | null }>();
    if (!row) return bad('Not found.', 404);
    if (row.group_id) await c.env.DB.prepare('DELETE FROM fit_workouts WHERE group_id = ? AND household_id = ?').bind(row.group_id, u.household_id).run();
    else await c.env.DB.prepare('DELETE FROM fit_workouts WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ ok: true });
  });

  app.patch('/api/fit/settings', async (c) => {
    const u = c.get('user');
    await getSettings(c.env, u.household_id);
    const b = await c.req.json<Record<string, unknown>>();
    const sets: string[] = [];
    const args: unknown[] = [];
    const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    if (date(b.start_date)) { sets.push('start_date = ?'); args.push(b.start_date); }
    if (date(b.wedding_date)) { sets.push('wedding_date = ?'); args.push(b.wedding_date); }
    if (Array.isArray(b.equipment)) { sets.push('equipment = ?'); args.push(JSON.stringify(b.equipment.filter((x) => typeof x === 'string').slice(0, 20))); }
    if (text(b.countdown_label, 60)) { sets.push('countdown_label = ?'); args.push(text(b.countdown_label, 60)); }
    if (text(b.pet_name, 24)) { sets.push('pet_name = ?'); args.push(text(b.pet_name, 24)); }
    if (['cat', 'dog', 'bunny', 'bear'].includes(b.pet_kind as string)) { sets.push('pet_kind = ?'); args.push(b.pet_kind); }
    if (typeof b.pet_color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(b.pet_color)) { sets.push('pet_color = ?'); args.push(b.pet_color); }
    if (sets.length) {
      sets.push('updated_at = ?');
      args.push(now());
      await c.env.DB.prepare(`UPDATE fit_settings SET ${sets.join(', ')} WHERE household_id = ?`).bind(...args, u.household_id).run();
    }
    return c.json(await summary(c.env, u));
  });

  app.patch('/api/fit/profile', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ level?: number; reminder_hour?: number | null; step?: number; evening_nudge?: boolean }>();
    const today = localDate(tz(c.env));
    await c.env.DB.prepare('INSERT OR IGNORE INTO fit_profiles (user_id, step_since, updated_at) VALUES (?, ?, ?)').bind(u.id, today, now()).run();
    if (typeof b.step === 'number' && b.step >= 1 && b.step <= STEPS.length) {
      await c.env.DB.prepare('UPDATE fit_profiles SET step = ?, step_since = ?, updated_at = ? WHERE user_id = ?').bind(Math.round(b.step), today, now(), u.id).run();
    }
    if (typeof b.level === 'number' && b.level >= 1 && b.level <= 3) {
      await c.env.DB.prepare('UPDATE fit_profiles SET level = ?, updated_at = ? WHERE user_id = ?').bind(Math.round(b.level), now(), u.id).run();
    }
    if (b.reminder_hour === null || (typeof b.reminder_hour === 'number' && b.reminder_hour >= 0 && b.reminder_hour <= 23)) {
      await c.env.DB.prepare('UPDATE fit_profiles SET reminder_hour = ?, updated_at = ? WHERE user_id = ?').bind(b.reminder_hour, now(), u.id).run();
    }
    if (typeof b.evening_nudge === 'boolean') {
      await c.env.DB.prepare('UPDATE fit_profiles SET evening_nudge = ?, updated_at = ? WHERE user_id = ?').bind(b.evening_nudge ? 1 : 0, now(), u.id).run();
    }
    return c.json(await summary(c.env, u));
  });

  app.get('/api/fit/measurements', async (c) => {
    const rows = await c.env.DB.prepare('SELECT * FROM fit_measurements WHERE household_id = ? ORDER BY date, created_at').bind(c.get('user').household_id).all();
    return c.json(rows.results);
  });

  app.post('/api/fit/measurements', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<Record<string, unknown>>();
    const num = (v: unknown) => (typeof v === 'number' && v > 0 && v < 500 ? Math.round(v * 10) / 10 : null);
    const vals = ['waist_cm', 'hips_cm', 'chest_cm', 'arm_cm', 'weight_kg'].map((k) => num(b[k]));
    if (vals.every((v) => v === null)) return bad('Enter at least one measurement.');
    const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : localDate(tz(c.env));
    const id = uid('fm_');
    await c.env.DB.prepare('INSERT INTO fit_measurements (id, household_id, user_id, date, waist_cm, hips_cm, chest_cm, arm_cm, weight_kg, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, u.household_id, u.id, date, ...vals, now()).run();
    return c.json(await c.env.DB.prepare('SELECT * FROM fit_measurements WHERE id = ?').bind(id).first(), 201);
  });

  app.delete('/api/fit/measurements/:id', async (c) => {
    const u = c.get('user');
    const r = await c.env.DB.prepare('DELETE FROM fit_measurements WHERE id = ? AND household_id = ? AND user_id = ?').bind(c.req.param('id'), u.household_id, u.id).run();
    if (!r.meta.changes) return bad('Only the person who logged a check in can remove it.', 404);
    return c.json({ ok: true });
  });
}
