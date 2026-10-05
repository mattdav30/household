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

// Routes for journeys. Distances come from the coordinates. The first journey is Road to Tokyo;
// when one finishes, the two of you pick the next route and how long to give it.
type RouteStop = { name: string; lat: number; lon: number; note: string };
const ROUTE_DEFS: Record<string, { title: string; blurb: string; stops: RouteStop[] }> = {
  tokyo: {
    title: 'Road to Tokyo',
    blurb: 'Brisbane up the coast, across the Pacific and on to a snowy onsen.',
    stops: [
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
      { name: 'The onsen', lat: 38.57, lon: 140.53, note: 'Snow, a private hot spring and tatami.' },
    ],
  },
  seoul: {
    title: 'Tokyo to Seoul',
    blurb: 'Down through Japan, over to Busan and up to Seoul.',
    stops: [
      { name: 'Tokyo', lat: 35.68, lon: 139.69, note: 'Starting line in Shinjuku.' },
      { name: 'Hakone', lat: 35.23, lon: 139.11, note: 'Views of Mount Fuji.' },
      { name: 'Nagoya', lat: 35.18, lon: 136.91, note: 'Castle and miso katsu.' },
      { name: 'Kyoto', lat: 35.01, lon: 135.77, note: 'Bamboo groves at dawn.' },
      { name: 'Osaka', lat: 34.69, lon: 135.5, note: 'Dotonbori lights.' },
      { name: 'Hiroshima', lat: 34.39, lon: 132.46, note: 'Peace park and okonomiyaki.' },
      { name: 'Fukuoka', lat: 33.59, lon: 130.4, note: 'Ramen stalls by the river.' },
      { name: 'Busan', lat: 35.18, lon: 129.08, note: 'Beaches and fish markets.' },
      { name: 'Gyeongju', lat: 35.86, lon: 129.22, note: 'Ancient tombs and temples.' },
      { name: 'Daegu', lat: 35.87, lon: 128.6, note: 'Hot pot and night markets.' },
      { name: 'Jeonju', lat: 35.82, lon: 127.15, note: 'Bibimbap at the source.' },
      { name: 'Seoul', lat: 37.57, lon: 126.98, note: 'Palaces and late night food.' },
    ],
  },
  lap: {
    title: 'Lap of Australia',
    blurb: 'Down the east coast, across the south, up the west and home through the Top End.',
    stops: [
      { name: 'Brisbane', lat: -27.47, lon: 153.03, note: 'Home. The lap starts here.' },
      { name: 'Byron Bay', lat: -28.64, lon: 153.61, note: 'The lighthouse walk.' },
      { name: 'Sydney', lat: -33.87, lon: 151.21, note: 'Harbour Bridge climb.' },
      { name: 'Canberra', lat: -35.28, lon: 149.13, note: 'Lake Burley Griffin loop.' },
      { name: 'Melbourne', lat: -37.81, lon: 144.96, note: 'The Tan track.' },
      { name: 'Adelaide', lat: -34.93, lon: 138.6, note: 'Wine country.' },
      { name: 'Esperance', lat: -33.86, lon: 121.89, note: 'Whitest sand in the country.' },
      { name: 'Perth', lat: -31.95, lon: 115.86, note: 'Kings Park.' },
      { name: 'Broome', lat: -17.96, lon: 122.24, note: 'Camels on Cable Beach.' },
      { name: 'Darwin', lat: -12.46, lon: 130.84, note: 'Mindil Beach sunset market.' },
      { name: 'Cairns', lat: -16.92, lon: 145.77, note: 'Reef and rainforest.' },
      { name: 'Townsville', lat: -19.26, lon: 146.82, note: 'Magnetic Island ferry.' },
      { name: 'Brisbane', lat: -27.47, lon: 153.03, note: 'Home again. Lap complete.' },
    ],
  },
  camino: {
    title: 'The Camino',
    blurb: 'The pilgrim walk across northern Spain to Santiago.',
    stops: [
      { name: 'Saint Jean', lat: 43.16, lon: -1.24, note: 'Foot of the Pyrenees.' },
      { name: 'Pamplona', lat: 42.81, lon: -1.64, note: 'First big city.' },
      { name: 'Logroño', lat: 42.47, lon: -2.45, note: 'Tapas on Calle Laurel.' },
      { name: 'Burgos', lat: 42.34, lon: -3.7, note: 'The great cathedral.' },
      { name: 'León', lat: 42.6, lon: -5.57, note: 'Stained glass and plazas.' },
      { name: 'Astorga', lat: 42.46, lon: -6.06, note: 'Chocolate town.' },
      { name: 'Ponferrada', lat: 42.55, lon: -6.6, note: 'Templar castle.' },
      { name: 'Sarria', lat: 42.78, lon: -7.41, note: 'Last 100 km.' },
      { name: 'Santiago', lat: 42.88, lon: -8.54, note: 'The cathedral square.' },
    ],
  },
};

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
const ROUTES = Object.fromEntries(Object.entries(ROUTE_DEFS).map(([id, def]) => {
  let km = 0;
  const stops = def.stops.map((s, i) => {
    if (i) km += haversine(def.stops[i - 1], s);
    return { ...s, km: Math.round(km) };
  });
  return [id, { id, title: def.title, blurb: def.blurb, stops, total_km: stops[stops.length - 1].km }];
}));
const routeOf = (id: string) => ROUTES[id] ?? ROUTES.tokyo;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
/** Monday of the week holding this date. */
export function weekStart(date: string) {
  const dow = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

type Settings = {
  household_id: string; start_date: string; wedding_date: string; weekly_goal_min: number; jar_cents: number;
  jar_goal_cents: number; equipment: string; default_stake: string; countdown_label: string; jar_label: string;
};
type Journey = { id: string; household_id: string; route: string; title: string; start_date: string; end_date: string; finished_at: number | null; created_at: number };
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

/** The journey in progress. A household with no journeys yet starts on Road to Tokyo, ending on the countdown date. */
async function activeJourney(env: Env, s: Settings, today: string): Promise<Journey | null> {
  const j = await env.DB.prepare('SELECT * FROM fit_journeys WHERE household_id = ? AND finished_at IS NULL ORDER BY created_at DESC LIMIT 1')
    .bind(s.household_id).first<Journey>();
  if (j) return j;
  const any = await env.DB.prepare('SELECT 1 FROM fit_journeys WHERE household_id = ? LIMIT 1').bind(s.household_id).first();
  if (any) return null;
  const end = s.wedding_date > addDays(today, 28) ? s.wedding_date : addDays(today, 7 * 26);
  const id = uid('jr_');
  await env.DB.prepare('INSERT INTO fit_journeys (id, household_id, route, title, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, s.household_id, 'tokyo', ROUTES.tokyo.title, s.start_date, end, now()).run();
  return env.DB.prepare('SELECT * FROM fit_journeys WHERE id = ?').bind(id).first<Journey>();
}

/** Where a journey stands: distance, stops, rewards and pace. */
async function journeyState(env: Env, j: Journey, weeklyGoal: number, today: string) {
  const route = routeOf(j.route);
  const [mins, rewards] = await env.DB.batch([
    env.DB.prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM fit_workouts WHERE household_id = ? AND date >= ? AND date <= ?').bind(j.household_id, j.start_date, j.end_date),
    env.DB.prepare('SELECT stop, title, claimed_at FROM fit_rewards WHERE journey_id = ?').bind(j.id),
  ]);
  const minutes = (mins.results[0] as { m: number }).m;
  const totalDays = Math.max(7, daysBetween(j.start_date, j.end_date) + 1);
  const goalMinutes = Math.max(30, Math.round((weeklyGoal * totalDays) / 7));
  const fraction = Math.min(1, minutes / goalMinutes);
  const km = Math.round(fraction * route.total_km);
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(j.start_date, today) + 1));
  const rewardMap = new Map((rewards.results as { stop: number; title: string; claimed_at: number | null }[]).map((r) => [r.stop, r]));
  const stops = route.stops.map((st, i) => ({
    ...st, index: i, reached: km >= st.km,
    reward: rewardMap.get(i)?.title ?? null, claimed_at: rewardMap.get(i)?.claimed_at ?? null,
  }));
  const next = stops.find((st) => !st.reached) ?? null;
  return {
    id: j.id, route: route.id, title: j.title, start_date: j.start_date, end_date: j.end_date, finished_at: j.finished_at,
    stops, total_km: route.total_km, km, fraction, minutes, goal_minutes: goalMinutes,
    expected_fraction: elapsed / totalDays, next: next ? next.index : null, km_per_minute: route.total_km / goalMinutes,
    week: Math.min(Math.ceil(totalDays / 7), Math.floor(Math.max(0, daysBetween(j.start_date, today)) / 7) + 1),
    total_weeks: Math.ceil(totalDays / 7),
    days_left: Math.max(0, daysBetween(today, j.end_date)),
    complete: fraction >= 1 || today > j.end_date,
    arrived: fraction >= 1,
    stops_reached: stops.filter((st) => st.reached).length,
  };
}

async function summary(env: Env, u: User) {
  const today = localDate(tz(env));
  const s = await getSettings(env, u.household_id);
  const journey = await activeJourney(env, s, today);
  // Two years of daily totals covers streaks and charts without loading every workout ever logged.
  const since = addDays(today, -730) > s.start_date ? addDays(today, -730) : s.start_date;
  const [members, profiles, daysQ, recentQ, challenges, banked, sessionsQ, journeysQ] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, color FROM users WHERE household_id = ? ORDER BY created_at').bind(u.household_id),
    env.DB.prepare('SELECT p.* FROM fit_profiles p JOIN users u ON u.id = p.user_id WHERE u.household_id = ?').bind(u.household_id),
    env.DB.prepare('SELECT user_id, date, SUM(minutes) AS m FROM fit_workouts WHERE household_id = ? AND date >= ? GROUP BY user_id, date').bind(u.household_id, since),
    env.DB.prepare('SELECT * FROM fit_workouts WHERE household_id = ? ORDER BY date DESC, created_at DESC LIMIT 12').bind(u.household_id),
    env.DB.prepare('SELECT * FROM fit_challenges WHERE household_id = ? AND week_start >= ?').bind(u.household_id, addDays(today, -14)),
    env.DB.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM fit_jar WHERE household_id = ?').bind(u.household_id),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM (SELECT user_id, date FROM fit_workouts WHERE household_id = ? AND date >= ?
      GROUP BY user_id, date HAVING SUM(minutes) >= ${FLOOR_MIN})`).bind(u.household_id, s.start_date),
    env.DB.prepare('SELECT COUNT(*) AS n FROM fit_journeys WHERE household_id = ? AND finished_at IS NOT NULL').bind(u.household_id),
  ]);
  const people = members.results as { id: string; name: string; color: string }[];
  const prof = new Map((profiles.results as { user_id: string; level: number; reminder_hour: number | null }[]).map((p) => [p.user_id, p]));

  // Minutes per person per day.
  const daily = new Map<string, Map<string, number>>(people.map((p) => [p.id, new Map()]));
  for (const r of daysQ.results as { user_id: string; date: string; m: number }[]) daily.get(r.user_id)?.set(r.date, r.m);
  const sumRange = (id: string, from: string, to: string) => {
    let t = 0;
    for (const [d, m] of daily.get(id) ?? []) if (d >= from && d <= to) t += m;
    return t;
  };
  const activeDays = (id: string, from: string) => {
    let n = 0;
    for (const [d, m] of daily.get(id) ?? []) if (d >= from && d <= today && m >= FLOOR_MIN) n++;
    return n;
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

  // Weekly challenge: most minutes wins.
  const stakeFor = (week: string) => (challenges.results as { week_start: string; stake: string; meal_id: string | null }[]).find((c) => c.week_start === week);
  const lastWs = addDays(ws, -7);
  const lastBy: Record<string, number> = {};
  for (const p of people) lastBy[p.id] = sumRange(p.id, lastWs, addDays(lastWs, 6));
  const ranked = [...people].sort((a, b) => lastBy[b.id] - lastBy[a.id]);
  const lastRow = stakeFor(lastWs);
  const tie = ranked.length < 2 || lastBy[ranked[0].id] === lastBy[ranked[1].id];
  const lastActive = Object.values(lastBy).some((m) => m > 0) && addDays(lastWs, 6) >= s.start_date;

  const sessions = (sessionsQ.results[0] as { n: number }).n;
  const countdownDays = daysBetween(today, s.wedding_date);

  return {
    today,
    settings: { ...s, equipment: JSON.parse(s.equipment || '[]') as string[] },
    members: people.map((p) => ({
      ...p, level: prof.get(p.id)?.level ?? 1, reminder_hour: prof.get(p.id)?.reminder_hour ?? 6,
      active_days_28: activeDays(p.id, addDays(today, -27)),
    })),
    me: u.id,
    countdown: { label: s.countdown_label, date: s.wedding_date, days: countdownDays },
    // Weeks of training since the very first day. Drives how hard workouts get, across every journey.
    week_index: Math.max(0, Math.floor(daysBetween(s.start_date, today) / 7)),
    week: { start: ws, goal: s.weekly_goal_min, by_user: weekBy, total: Object.values(weekBy).reduce((a, b) => a + b, 0), days: weekDays },
    streaks: Object.fromEntries(people.map((p) => [p.id, streakFor(daily.get(p.id)!, since, today)])),
    journey: journey ? await journeyState(env, journey, s.weekly_goal_min, today) : null,
    journeys_finished: (journeysQ.results[0] as { n: number }).n,
    routes: Object.values(ROUTES).map((r) => ({ id: r.id, title: r.title, blurb: r.blurb, total_km: r.total_km, stops: r.stops.length, from: r.stops[0].name, to: r.stops[r.stops.length - 1].name })),
    challenge: {
      week_start: ws, stake: stakeFor(ws)?.stake ?? s.default_stake, by_user: weekBy,
      last: lastActive ? {
        week_start: lastWs, stake: lastRow?.stake ?? s.default_stake, by_user: lastBy, meal_id: lastRow?.meal_id ?? null,
        winner: tie ? null : ranked[0].id, loser: tie ? null : ranked[ranked.length - 1].id,
      } : null,
    },
    jar: {
      sessions, rate_cents: s.jar_cents, earned_cents: sessions * s.jar_cents, label: s.jar_label,
      banked_cents: (banked.results[0] as { cents: number }).cents, goal_cents: s.jar_goal_cents,
    },
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
    const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;
    if (date(b.start_date)) { sets.push('start_date = ?'); args.push(b.start_date); }
    if (date(b.wedding_date)) { sets.push('wedding_date = ?'); args.push(b.wedding_date); }
    if (int(b.weekly_goal_min, 30, 3000)) { sets.push('weekly_goal_min = ?'); args.push(Math.round(b.weekly_goal_min as number)); }
    if (int(b.jar_cents, 0, 100000)) { sets.push('jar_cents = ?'); args.push(Math.round(b.jar_cents as number)); }
    if (int(b.jar_goal_cents, 0, 10000000)) { sets.push('jar_goal_cents = ?'); args.push(Math.round(b.jar_goal_cents as number)); }
    if (Array.isArray(b.equipment)) { sets.push('equipment = ?'); args.push(JSON.stringify(b.equipment.filter((x) => typeof x === 'string').slice(0, 20))); }
    if (typeof b.default_stake === 'string' && b.default_stake.trim()) { sets.push('default_stake = ?'); args.push(b.default_stake.trim().slice(0, 120)); }
    if (typeof b.countdown_label === 'string' && b.countdown_label.trim()) { sets.push('countdown_label = ?'); args.push(b.countdown_label.trim().slice(0, 60)); }
    if (typeof b.jar_label === 'string' && b.jar_label.trim()) { sets.push('jar_label = ?'); args.push(b.jar_label.trim().slice(0, 60)); }
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

  // Rewards belong to the journey in progress.
  const current = async (env: Env, u: User) => {
    const today = localDate(tz(env));
    return activeJourney(env, await getSettings(env, u.household_id), today);
  };

  app.put('/api/fit/rewards/:stop', async (c) => {
    const u = c.get('user');
    const j = await current(c.env, u);
    if (!j) return bad('Start a journey first.');
    const stop = Number(c.req.param('stop'));
    if (!(stop >= 1 && stop < routeOf(j.route).stops.length)) return bad('Unknown stop.');
    const title = ((await c.req.json<{ title?: string }>()).title ?? '').trim().slice(0, 120);
    if (!title) await c.env.DB.prepare('DELETE FROM fit_rewards WHERE journey_id = ? AND stop = ?').bind(j.id, stop).run();
    else await c.env.DB.prepare('INSERT INTO fit_rewards (journey_id, stop, title) VALUES (?, ?, ?) ON CONFLICT (journey_id, stop) DO UPDATE SET title = excluded.title')
      .bind(j.id, stop, title).run();
    return c.json(await summary(c.env, u));
  });

  app.post('/api/fit/rewards/:stop/claim', async (c) => {
    const u = c.get('user');
    const j = await current(c.env, u);
    if (!j) return bad('Start a journey first.');
    const r = await c.env.DB.prepare('UPDATE fit_rewards SET claimed_at = ? WHERE journey_id = ? AND stop = ?').bind(now(), j.id, Number(c.req.param('stop'))).run();
    if (!r.meta.changes) return bad('Set a reward for this stop first.', 404);
    return c.json(await summary(c.env, u));
  });

  // Change the name or end date of the journey in progress.
  app.patch('/api/fit/journey', async (c) => {
    const u = c.get('user');
    const j = await current(c.env, u);
    if (!j) return bad('Start a journey first.');
    const b = await c.req.json<{ title?: string; end_date?: string }>();
    if (typeof b.title === 'string' && b.title.trim()) await c.env.DB.prepare('UPDATE fit_journeys SET title = ? WHERE id = ?').bind(b.title.trim().slice(0, 60), j.id).run();
    if (typeof b.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.end_date) && b.end_date > addDays(j.start_date, 6)) {
      await c.env.DB.prepare('UPDATE fit_journeys SET end_date = ? WHERE id = ?').bind(b.end_date, j.id).run();
    }
    return c.json(await summary(c.env, u));
  });

  // Finish the journey in progress and start the next one from today.
  app.post('/api/fit/journeys', async (c) => {
    const u = c.get('user');
    const b = await c.req.json<{ route?: string; title?: string; weeks?: number; end_date?: string }>();
    const route = ROUTES[b.route ?? ''];
    if (!route) return bad('Pick a route.');
    const today = localDate(tz(c.env));
    const end = /^\d{4}-\d{2}-\d{2}$/.test(b.end_date ?? '') && b.end_date! > addDays(today, 6)
      ? b.end_date!
      : addDays(today, Math.round(7 * Math.min(104, Math.max(2, Number(b.weeks) || 12))) - 1);
    await getSettings(c.env, u.household_id);
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE fit_journeys SET finished_at = ? WHERE household_id = ? AND finished_at IS NULL').bind(now(), u.household_id),
      c.env.DB.prepare('INSERT INTO fit_journeys (id, household_id, route, title, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(uid('jr_'), u.household_id, route.id, (b.title ?? '').trim().slice(0, 60) || route.title, today, end, now()),
    ]);
    return c.json(await summary(c.env, u), 201);
  });

  // Finished journeys, newest first, for the trophy shelf.
  app.get('/api/fit/journeys', async (c) => {
    const u = c.get('user');
    const s = await getSettings(c.env, u.household_id);
    const today = localDate(tz(c.env));
    const rows = (await c.env.DB.prepare('SELECT * FROM fit_journeys WHERE household_id = ? AND finished_at IS NOT NULL ORDER BY created_at DESC')
      .bind(u.household_id).all<Journey>()).results;
    const out = [];
    for (const j of rows) {
      const st = await journeyState(c.env, j, s.weekly_goal_min, today);
      out.push({
        id: j.id, title: j.title, route: j.route, start_date: j.start_date, end_date: j.end_date, finished_at: j.finished_at,
        minutes: st.minutes, km: st.km, total_km: st.total_km, fraction: st.fraction, arrived: st.arrived,
        stops_reached: st.stops_reached, stops: st.stops.length, furthest: [...st.stops].reverse().find((x) => x.reached)?.name ?? st.stops[0].name,
      });
    }
    return c.json(out);
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
