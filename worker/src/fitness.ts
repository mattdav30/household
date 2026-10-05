// Road to Tokyo: the fitness side of the API. Same accounts and households as Household,
// mounted under /api/fit so the generic list routes never see these paths.
import type { Hono } from 'hono';
import { addDays, localDate, now, uid } from './lib';

type Env = { DB: D1Database; TZ_OFFSET_MIN: string };
type User = { id: string; household_id: string; email: string; name: string; color: string };
type App = Hono<{ Bindings: Env; Variables: { user: User } }>;

const bad = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { 'content-type': 'application/json' },
});
const tz = (env: Env) => Number(env.TZ_OFFSET_MIN ?? 600);

/** A day counts towards a streak and the gym fund once someone moves this many minutes. */
export const FLOOR_MIN = 10;
const SHIELDS_PER_MONTH = 2;
export const KINDS = ['home', 'walk', 'jog', 'stairs', 'partner', 'dance', 'stretch', 'outdoor', 'sport', 'other'] as const;

// The route from Brisbane to the honeymoon onsen. Distances come from the coordinates.
const ROUTE: { name: string; lat: number; lon: number; note: string }[] = [
  { name: 'Brisbane', lat: -27.47, lon: 153.03, note: 'Home. The journey starts here.' },
  { name: 'Rockhampton', lat: -23.38, lon: 150.51, note: 'Beef capital of Australia.' },
  { name: 'Mackay', lat: -21.14, lon: 149.19, note: 'Gateway to the Whitsundays.' },
  { name: 'Townsville', lat: -19.26, lon: 146.82, note: 'Castle Hill and the Strand.' },
  { name: 'Cairns', lat: -16.92, lon: 145.77, note: 'Last stop in Australia.' },
  { name: 'Port Moresby', lat: -9.44, lon: 147.18, note: 'Across the Coral Sea.' },
  { name: 'Chuuk', lat: 7.45, lon: 151.85, note: 'Lagoon full of wartime wrecks.' },
  { name: 'Guam', lat: 13.44, lon: 144.79, note: 'Halfway mark across the Pacific.' },
  { name: 'Saipan', lat: 15.18, lon: 145.75, note: 'Northern Mariana Islands.' },
  { name: 'Okinawa', lat: 26.21, lon: 127.68, note: 'First taste of Japan.' },
  { name: 'Kagoshima', lat: 31.6, lon: 130.56, note: 'Sakurajima volcano across the bay.' },
  { name: 'Osaka', lat: 34.69, lon: 135.5, note: 'Street food city.' },
  { name: 'Kyoto', lat: 35.01, lon: 135.77, note: 'Temples and quiet lanes.' },
  { name: 'Tokyo', lat: 35.68, lon: 139.69, note: 'Two nights at The Edo Sakura.' },
  { name: 'The onsen', lat: 38.57, lon: 140.53, note: 'Snow, a private hot spring and tatami. Wedding week.' },
];

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
const STOPS = (() => {
  let km = 0;
  return ROUTE.map((s, i) => {
    if (i) km += haversine(ROUTE[i - 1], s);
    return { ...s, km: Math.round(km) };
  });
})();
const TOTAL_KM = STOPS[STOPS.length - 1].km;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
/** Monday of the week holding this date. */
export function weekStart(date: string) {
  const dow = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

type Settings = {
  household_id: string; start_date: string; wedding_date: string; weekly_goal_min: number; jar_cents: number;
  jar_goal_cents: number; equipment: string; default_stake: string;
};
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
  let lastShield: string | null = null;
  const used: Record<string, number> = {};
  for (let d = from; d < today; d = addDays(d, 1)) {
    const month = d.slice(0, 7);
    if ((daily.get(d) ?? 0) >= FLOOR_MIN) days++;
    else if (days > 0 && (used[month] ?? 0) < SHIELDS_PER_MONTH) { used[month] = (used[month] ?? 0) + 1; lastShield = d; }
    else days = 0;
  }
  const doneToday = (daily.get(today) ?? 0) >= FLOOR_MIN;
  if (doneToday) days++;
  return { days, done_today: doneToday, shields_left: SHIELDS_PER_MONTH - (used[today.slice(0, 7)] ?? 0), last_shield: lastShield };
}

async function summary(env: Env, u: User) {
  const today = localDate(tz(env));
  const s = await getSettings(env, u.household_id);
  const [members, profiles, workouts, rewards, challenges, banked] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, color FROM users WHERE household_id = ? ORDER BY created_at').bind(u.household_id),
    env.DB.prepare('SELECT p.* FROM fit_profiles p JOIN users u ON u.id = p.user_id WHERE u.household_id = ?').bind(u.household_id),
    env.DB.prepare('SELECT * FROM fit_workouts WHERE household_id = ? ORDER BY date DESC, created_at DESC').bind(u.household_id),
    env.DB.prepare('SELECT stop, title, claimed_at FROM fit_rewards WHERE household_id = ?').bind(u.household_id),
    env.DB.prepare('SELECT * FROM fit_challenges WHERE household_id = ?').bind(u.household_id),
    env.DB.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM fit_jar WHERE household_id = ?').bind(u.household_id),
  ]);
  const people = members.results as { id: string; name: string; color: string }[];
  const prof = new Map((profiles.results as { user_id: string; level: number; reminder_hour: number | null }[]).map((p) => [p.user_id, p]));
  const all = workouts.results as Workout[];

  // Minutes per person per day.
  const daily = new Map<string, Map<string, number>>(people.map((p) => [p.id, new Map()]));
  for (const w of all) {
    const m = daily.get(w.user_id);
    if (m) m.set(w.date, (m.get(w.date) ?? 0) + w.minutes);
  }
  const sumRange = (id: string, from: string, to: string) => {
    let t = 0;
    for (const [d, m] of daily.get(id) ?? []) if (d >= from && d <= to) t += m;
    return t;
  };

  // This week, Monday to Sunday.
  const ws = weekStart(today);
  const we = addDays(ws, 6);
  const weekBy: Record<string, number> = {};
  for (const p of people) weekBy[p.id] = sumRange(p.id, ws, we);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    return { date: d, by_user: Object.fromEntries(people.map((p) => [p.id, daily.get(p.id)?.get(d) ?? 0])) };
  });

  // The journey: every minute since the start date moves the pair along the route.
  const totalDays = Math.max(7, daysBetween(s.start_date, s.wedding_date));
  const goalMinutes = Math.round((s.weekly_goal_min * totalDays) / 7);
  let journeyMinutes = 0;
  for (const p of people) journeyMinutes += sumRange(p.id, s.start_date, s.wedding_date);
  const fraction = Math.min(1, journeyMinutes / goalMinutes);
  const km = Math.round(fraction * TOTAL_KM);
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(s.start_date, today) + 1));
  const rewardMap = new Map((rewards.results as { stop: number; title: string; claimed_at: number | null }[]).map((r) => [r.stop, r]));
  const stops = STOPS.map((st, i) => ({
    ...st, index: i, reached: km >= st.km,
    reward: rewardMap.get(i)?.title ?? null, claimed_at: rewardMap.get(i)?.claimed_at ?? null,
  }));
  const next = stops.find((st) => !st.reached) ?? null;

  // Weekly challenge: most minutes wins.
  const stakeFor = (week: string) => (challenges.results as { week_start: string; stake: string; meal_id: string | null }[]).find((c) => c.week_start === week);
  const lastWs = addDays(ws, -7);
  const lastBy: Record<string, number> = {};
  for (const p of people) lastBy[p.id] = sumRange(p.id, lastWs, addDays(lastWs, 6));
  const ranked = [...people].sort((a, b) => lastBy[b.id] - lastBy[a.id]);
  const lastRow = stakeFor(lastWs);
  const tie = ranked.length < 2 || lastBy[ranked[0].id] === lastBy[ranked[1].id];
  const lastActive = Object.values(lastBy).some((m) => m > 0) && lastWs >= s.start_date;

  // Gym fund: one coin per person per day with FLOOR_MIN or more minutes.
  let sessions = 0;
  for (const m of daily.values()) for (const [d, min] of m) if (min >= FLOOR_MIN && d >= s.start_date) sessions++;

  return {
    today,
    settings: { ...s, equipment: JSON.parse(s.equipment || '[]') as string[] },
    members: people.map((p) => ({ ...p, level: prof.get(p.id)?.level ?? 1, reminder_hour: prof.get(p.id)?.reminder_hour ?? 6 })),
    me: u.id,
    days_to_wedding: daysBetween(today, s.wedding_date),
    week_index: Math.max(0, Math.floor(daysBetween(s.start_date, today) / 7)),
    total_weeks: Math.ceil(totalDays / 7),
    week: { start: ws, goal: s.weekly_goal_min, by_user: weekBy, total: Object.values(weekBy).reduce((a, b) => a + b, 0), days: weekDays },
    streaks: Object.fromEntries(people.map((p) => [p.id, streakFor(daily.get(p.id)!, s.start_date, today)])),
    journey: {
      stops, total_km: TOTAL_KM, km, fraction, minutes: journeyMinutes, goal_minutes: goalMinutes,
      expected_fraction: elapsed / totalDays, next: next ? next.index : null,
      km_per_minute: TOTAL_KM / goalMinutes,
    },
    challenge: {
      week_start: ws, stake: stakeFor(ws)?.stake ?? s.default_stake, by_user: weekBy,
      last: lastActive ? {
        week_start: lastWs, stake: lastRow?.stake ?? s.default_stake, by_user: lastBy, meal_id: lastRow?.meal_id ?? null,
        winner: tie ? null : ranked[0].id, loser: tie ? null : ranked[ranked.length - 1].id,
      } : null,
    },
    jar: {
      sessions, rate_cents: s.jar_cents, earned_cents: sessions * s.jar_cents,
      banked_cents: (banked.results[0] as { cents: number }).cents, goal_cents: s.jar_goal_cents,
    },
    recent: all.slice(0, 12),
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
    const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;
    if (date(b.start_date)) { sets.push('start_date = ?'); args.push(b.start_date); }
    if (date(b.wedding_date)) { sets.push('wedding_date = ?'); args.push(b.wedding_date); }
    if (int(b.weekly_goal_min, 30, 3000)) { sets.push('weekly_goal_min = ?'); args.push(Math.round(b.weekly_goal_min as number)); }
    if (int(b.jar_cents, 0, 100000)) { sets.push('jar_cents = ?'); args.push(Math.round(b.jar_cents as number)); }
    if (int(b.jar_goal_cents, 0, 10000000)) { sets.push('jar_goal_cents = ?'); args.push(Math.round(b.jar_goal_cents as number)); }
    if (Array.isArray(b.equipment)) { sets.push('equipment = ?'); args.push(JSON.stringify(b.equipment.filter((x) => typeof x === 'string').slice(0, 20))); }
    if (typeof b.default_stake === 'string' && b.default_stake.trim()) { sets.push('default_stake = ?'); args.push(b.default_stake.trim().slice(0, 120)); }
    if (sets.length) {
      sets.push('updated_at = ?');
      args.push(now());
      await c.env.DB.prepare(`UPDATE fit_settings SET ${sets.join(', ')} WHERE household_id = ?`).bind(...args, u.household_id).run();
    }
    return c.json(await summary(c.env, u));
  });

  app.patch('/api/fit/profile', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ level?: number; reminder_hour?: number | null }>();
    await c.env.DB.prepare('INSERT OR IGNORE INTO fit_profiles (user_id, updated_at) VALUES (?, ?)').bind(u.id, now()).run();
    if (typeof b.level === 'number' && b.level >= 1 && b.level <= 3) {
      await c.env.DB.prepare('UPDATE fit_profiles SET level = ?, updated_at = ? WHERE user_id = ?').bind(Math.round(b.level), now(), u.id).run();
    }
    if (b.reminder_hour === null || (typeof b.reminder_hour === 'number' && b.reminder_hour >= 0 && b.reminder_hour <= 23)) {
      await c.env.DB.prepare('UPDATE fit_profiles SET reminder_hour = ?, updated_at = ? WHERE user_id = ?').bind(b.reminder_hour, now(), u.id).run();
    }
    return c.json(await summary(c.env, u));
  });

  app.put('/api/fit/rewards/:stop', async (c) => {
    const u = c.get('user');
    const stop = Number(c.req.param('stop'));
    if (!(stop >= 1 && stop < STOPS.length)) return bad('Unknown stop.');
    const title = ((await c.req.json<{ title?: string }>()).title ?? '').trim().slice(0, 120);
    if (!title) await c.env.DB.prepare('DELETE FROM fit_rewards WHERE household_id = ? AND stop = ?').bind(u.household_id, stop).run();
    else await c.env.DB.prepare('INSERT INTO fit_rewards (household_id, stop, title) VALUES (?, ?, ?) ON CONFLICT (household_id, stop) DO UPDATE SET title = excluded.title')
      .bind(u.household_id, stop, title).run();
    return c.json(await summary(c.env, u));
  });

  app.post('/api/fit/rewards/:stop/claim', async (c) => {
    const u = c.get('user');
    const stop = Number(c.req.param('stop'));
    const r = await c.env.DB.prepare('UPDATE fit_rewards SET claimed_at = ? WHERE household_id = ? AND stop = ?').bind(now(), u.household_id, stop).run();
    if (!r.meta.changes) return bad('Set a reward for this stop first.', 404);
    return c.json(await summary(c.env, u));
  });

  app.put('/api/fit/challenge', async (c) => {
    const u = c.get('user');
    const stake = ((await c.req.json<{ stake?: string }>()).stake ?? '').trim().slice(0, 120);
    if (!stake) return bad('Enter a stake.');
    const ws = weekStart(localDate(tz(c.env)));
    await c.env.DB.prepare('INSERT INTO fit_challenges (household_id, week_start, stake) VALUES (?, ?, ?) ON CONFLICT (household_id, week_start) DO UPDATE SET stake = excluded.stake')
      .bind(u.household_id, ws, stake).run();
    return c.json(await summary(c.env, u));
  });

  // Puts last week's forfeit straight onto the Household meal plan.
  app.post('/api/fit/challenge/cook', async (c) => {
    const u = c.get('user');
    const s = await summary(c.env, u);
    const last = s.challenge.last;
    if (!last?.loser) return bad('Last week ended in a tie, so nobody cooks.');
    const b = await c.req.json<{ date?: string }>().catch(() => ({} as { date?: string }));
    const saturday = addDays(s.week.start, 5);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '') ? b.date! : (saturday >= s.today ? saturday : s.today);
    const loser = s.members.find((m) => m.id === last.loser)!;
    const mealId = uid('m_');
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO meals (id, household_id, date, slot, title, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(mealId, u.household_id, date, 'dinner', `${loser.name} cooks`, `Lost the Road to Tokyo challenge: ${last.stake}`, now(), now()),
      c.env.DB.prepare('INSERT INTO fit_challenges (household_id, week_start, stake, meal_id) VALUES (?, ?, ?, ?) ON CONFLICT (household_id, week_start) DO UPDATE SET meal_id = excluded.meal_id')
        .bind(u.household_id, last.week_start, last.stake, mealId),
    ]);
    return c.json({ meal_id: mealId, date, summary: await summary(c.env, u) });
  });

  app.post('/api/fit/jar', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ amount_cents?: number; note?: string }>();
    const cents = Math.round(Number(b.amount_cents));
    if (!(cents > 0 && cents <= 10000000)) return bad('Enter an amount.');
    await c.env.DB.prepare('INSERT INTO fit_jar (id, household_id, amount_cents, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uid('j_'), u.household_id, cents, (b.note ?? '').trim() || null, localDate(tz(c.env)), now()).run();
    return c.json(await summary(c.env, u), 201);
  });

  app.get('/api/fit/jar', async (c) => {
    const rows = await c.env.DB.prepare('SELECT * FROM fit_jar WHERE household_id = ? ORDER BY created_at DESC').bind(c.get('user').household_id).all();
    return c.json(rows.results);
  });

  app.delete('/api/fit/jar/:id', async (c) => {
    await c.env.DB.prepare('DELETE FROM fit_jar WHERE id = ? AND household_id = ?').bind(c.req.param('id'), c.get('user').household_id).run();
    return c.json({ ok: true });
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
