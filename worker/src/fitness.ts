// Road to Tokyo: the fitness side of the API. Same accounts and households as Household,
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

/** The pet grows with every day either of you moves. */
const STAGES = [
  { at: 0, name: 'Baby' },
  { at: 10, name: 'Little' },
  { at: 30, name: 'Grown' },
  { at: 75, name: 'Scarf' },
  { at: 150, name: 'Crown' },
];

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
  const [members, profiles, daysQ, recentQ, kindsQ] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, color FROM users WHERE household_id = ? ORDER BY created_at').bind(u.household_id),
    env.DB.prepare('SELECT p.* FROM fit_profiles p JOIN users u ON u.id = p.user_id WHERE u.household_id = ?').bind(u.household_id),
    env.DB.prepare('SELECT user_id, date, SUM(minutes) AS m FROM fit_workouts WHERE household_id = ? AND date >= ? GROUP BY user_id, date').bind(u.household_id, since),
    env.DB.prepare('SELECT * FROM fit_workouts WHERE household_id = ? ORDER BY date DESC, created_at DESC LIMIT 12').bind(u.household_id),
    env.DB.prepare(`SELECT user_id, SUM(together) AS together, SUM(CASE WHEN kind IN ('home', 'partner', 'stairs', 'jog') THEN 1 ELSE 0 END) AS workouts
      FROM fit_workouts WHERE household_id = ? GROUP BY user_id`).bind(u.household_id),
  ]);
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
  const mood = !anyEver ? 'new' : ratio >= 0.75 ? 'thrilled' : ratio >= 0.45 ? 'happy' : ratio >= 0.2 ? 'okay' : 'sad';
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
    },
    badges: BADGES.map((b) => ({ ...b, earned: earned.has(b.id) })),
    recent: recentQ.results as Workout[],
  };
}

export function registerFitness(app: App) {
  app.get('/api/fit/summary', async (c) => c.json(await summary(c.env, c.get('user'))));

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
    return c.json({ ids, summary: await summary(c.env, u) }, 201);
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
