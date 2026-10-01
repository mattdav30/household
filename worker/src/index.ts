import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  uid, inviteCode, hashPassword, safeEqual, now, localDate, addDays, advance, guessAisle, sendPush, PushMsg,
} from './lib';

type Env = { DB: D1Database; TZ_OFFSET_MIN: string };
type User = { id: string; household_id: string; email: string; name: string; color: string };
type Vars = { user: User };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();
app.use('*', cors());

const SESSION_DAYS = 365;
const tz = (env: Env) => Number(env.TZ_OFFSET_MIN ?? 600);

// Columns each table accepts from the app. Anything else is ignored.
const TABLES: Record<string, string[]> = {
  shopping_items: ['name', 'qty', 'aisle', 'checked'],
  recipes: ['title', 'ingredients', 'url', 'notes'],
  meals: ['date', 'slot', 'title', 'recipe_id', 'notes'],
  chores: ['title', 'assignee_id', 'due_date', 'repeat', 'done_at', 'notes'],
  events: ['title', 'date', 'start_time', 'end_time', 'who', 'location', 'notes'],
  bills: ['name', 'amount_cents', 'due_date', 'repeat', 'last_paid_at', 'notes'],
  wishes: ['list', 'title', 'url', 'price_cents', 'for_whom', 'status', 'notes'],
};
const REQUIRED: Record<string, string[]> = {
  shopping_items: ['name'], recipes: ['title'], meals: ['date', 'title'], chores: ['title'],
  events: ['title', 'date'], bills: ['name', 'due_date'], wishes: ['title'],
};

const bad = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { 'content-type': 'application/json' },
});

// ---------- Auth ----------

async function createSession(db: D1Database, userId: string) {
  const token = uid('s_') + uid();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, now() + SESSION_DAYS * 86400000).run();
  return token;
}

async function profile(db: D1Database, userId: string) {
  const user = await db.prepare('SELECT id, household_id, email, name, color FROM users WHERE id = ?').bind(userId).first<User>();
  const household = await db.prepare('SELECT id, name, invite_code FROM households WHERE id = ?').bind(user!.household_id).first();
  const members = (await db.prepare('SELECT id, name, color FROM users WHERE household_id = ? ORDER BY created_at')
    .bind(user!.household_id).all()).results;
  return { user, household, members };
}

app.get('/', (c) => c.json({ ok: true, app: 'household' }));

app.post('/auth/register', async (c) => {
  const b = await c.req.json<{ email?: string; name?: string; password?: string; invite_code?: string; household_name?: string }>();
  const email = (b.email ?? '').trim().toLowerCase();
  const name = (b.name ?? '').trim();
  if (!email.includes('@') || !name || (b.password ?? '').length < 8) {
    return bad('Enter a name, a valid email and a password of 8 or more characters.');
  }
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) return bad('An account with this email already exists. Sign in instead.', 409);

  let householdId: string;
  const stmts: D1PreparedStatement[] = [];
  if (b.invite_code) {
    const h = await c.env.DB.prepare('SELECT id FROM households WHERE invite_code = ?')
      .bind(b.invite_code.trim().toUpperCase()).first<{ id: string }>();
    if (!h) return bad('Invite code not found. Check the code in Settings on the other phone.', 404);
    householdId = h.id;
  } else {
    householdId = uid('h_');
    stmts.push(c.env.DB.prepare('INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
      .bind(householdId, (b.household_name ?? '').trim() || 'Home', inviteCode(), now()));
  }
  const { hash, salt } = await hashPassword(b.password!);
  const userId = uid('u_');
  const color = b.invite_code ? '#B4654A' : '#1F6F5C';
  stmts.push(c.env.DB.prepare('INSERT INTO users (id, household_id, email, name, pass_hash, pass_salt, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(userId, householdId, email, name, hash, salt, color, now()));
  await c.env.DB.batch(stmts);
  const token = await createSession(c.env.DB, userId);
  return c.json({ token, ...(await profile(c.env.DB, userId)) });
});

app.post('/auth/login', async (c) => {
  const b = await c.req.json<{ email?: string; password?: string }>();
  const email = (b.email ?? '').trim().toLowerCase();
  const row = await c.env.DB.prepare('SELECT id, pass_hash, pass_salt FROM users WHERE email = ?')
    .bind(email).first<{ id: string; pass_hash: string; pass_salt: string }>();
  if (!row) return bad('Email or password incorrect.', 401);
  const { hash } = await hashPassword(b.password ?? '', row.pass_salt);
  if (!safeEqual(hash, row.pass_hash)) return bad('Email or password incorrect.', 401);
  const token = await createSession(c.env.DB, row.id);
  return c.json({ token, ...(await profile(c.env.DB, row.id)) });
});

// Everything below needs a signed in user.
app.use('/api/*', async (c, next) => {
  const token = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return bad('Sign in required.', 401);
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.household_id, u.email, u.name, u.color FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`,
  ).bind(token, now()).first<User>();
  if (!user) return bad('Session expired. Sign in again.', 401);
  c.set('user', user);
  await next();
});

app.get('/api/me', async (c) => c.json(await profile(c.env.DB, c.get('user').id)));

app.post('/api/logout', async (c) => {
  const token = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
  await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return c.json({ ok: true });
});

app.patch('/api/me', async (c) => {
  const b = await c.req.json<{ name?: string; color?: string; household_name?: string }>();
  const u = c.get('user');
  if (b.name?.trim()) await c.env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(b.name.trim(), u.id).run();
  if (b.color) await c.env.DB.prepare('UPDATE users SET color = ? WHERE id = ?').bind(b.color, u.id).run();
  if (b.household_name?.trim()) {
    await c.env.DB.prepare('UPDATE households SET name = ? WHERE id = ?').bind(b.household_name.trim(), u.household_id).run();
  }
  return c.json(await profile(c.env.DB, u.id));
});

app.post('/api/push', async (c) => {
  const { token } = await c.req.json<{ token?: string }>();
  if (!token) return bad('Missing token.');
  await c.env.DB.prepare(
    'INSERT INTO push_tokens (token, user_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at',
  ).bind(token, c.get('user').id, now()).run();
  return c.json({ ok: true });
});

// ---------- Push to the other person in the household ----------

async function notifyOthers(env: Env, user: User, title: string, body: string, data: Record<string, unknown> = {}) {
  const rows = (await env.DB.prepare(
    'SELECT p.token FROM push_tokens p JOIN users u ON u.id = p.user_id WHERE u.household_id = ? AND u.id != ?',
  ).bind(user.household_id, user.id).all<{ token: string }>()).results;
  await sendPush(rows.map((r) => ({ to: r.token, title, body, data })));
}

const describe: Record<string, (row: Record<string, unknown>) => [string, string] | null> = {
  shopping_items: (r) => ['Shopping list', `added ${r.name}${r.qty ? ` (${r.qty})` : ''}`],
  events: (r) => ['Calendar', `added ${r.title} on ${r.date}`],
  chores: (r) => ['Chores', `added ${r.title}${r.due_date ? `, due ${r.due_date}` : ''}`],
  bills: (r) => ['Bills', `added ${r.name}, due ${r.due_date}`],
  wishes: (r) => ['Lists', `added ${r.title}`],
  meals: (r) => ['Meals', `planned ${r.title} for ${r.date}`],
  recipes: () => null,
};

// ---------- Special actions ----------

app.get('/api/today', async (c) => {
  const u = c.get('user');
  const today = localDate(tz(c.env));
  const week = addDays(today, 7);
  const db = c.env.DB;
  const [events, meals, chores, bills, shopping] = await db.batch([
    db.prepare('SELECT * FROM events WHERE household_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_time').bind(u.household_id, today, addDays(today, 2)),
    db.prepare('SELECT * FROM meals WHERE household_id = ? AND date = ? ORDER BY slot').bind(u.household_id, today),
    db.prepare('SELECT * FROM chores WHERE household_id = ? AND done_at IS NULL AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date').bind(u.household_id, today),
    db.prepare('SELECT * FROM bills WHERE household_id = ? AND due_date <= ? ORDER BY due_date').bind(u.household_id, week),
    db.prepare('SELECT COUNT(*) AS n FROM shopping_items WHERE household_id = ? AND checked = 0').bind(u.household_id),
  ]);
  return c.json({
    today,
    events: events.results,
    meals: meals.results,
    chores: chores.results,
    bills: bills.results,
    shopping_open: (shopping.results[0] as { n: number }).n,
  });
});

app.post('/api/chores/:id/complete', async (c) => {
  const u = c.get('user');
  const chore = await c.env.DB.prepare('SELECT * FROM chores WHERE id = ? AND household_id = ?')
    .bind(c.req.param('id'), u.household_id).first<{ id: string; due_date: string | null; repeat: string; title: string }>();
  if (!chore) return bad('Not found.', 404);
  const next = chore.due_date ? advance(chore.due_date, chore.repeat) : null;
  if (next) {
    // Repeating chore: roll forward past today so a missed chore lands on the next real date.
    let due = next;
    const today = localDate(tz(c.env));
    while (due < today) due = advance(due, chore.repeat)!;
    await c.env.DB.prepare('UPDATE chores SET due_date = ?, done_at = NULL, updated_at = ? WHERE id = ?').bind(due, now(), chore.id).run();
  } else {
    await c.env.DB.prepare('UPDATE chores SET done_at = ?, updated_at = ? WHERE id = ?').bind(now(), now(), chore.id).run();
  }
  c.executionCtx.waitUntil(notifyOthers(c.env, u, 'Chores', `${u.name} finished ${chore.title}`));
  return c.json(await c.env.DB.prepare('SELECT * FROM chores WHERE id = ?').bind(chore.id).first());
});

app.post('/api/bills/:id/paid', async (c) => {
  const u = c.get('user');
  const bill = await c.env.DB.prepare('SELECT * FROM bills WHERE id = ? AND household_id = ?')
    .bind(c.req.param('id'), u.household_id).first<{ id: string; due_date: string; repeat: string; name: string }>();
  if (!bill) return bad('Not found.', 404);
  const next = advance(bill.due_date, bill.repeat);
  if (next) {
    await c.env.DB.prepare('UPDATE bills SET due_date = ?, last_paid_at = ?, updated_at = ? WHERE id = ?').bind(next, now(), now(), bill.id).run();
  } else {
    await c.env.DB.prepare('DELETE FROM bills WHERE id = ?').bind(bill.id).run();
    return c.json({ deleted: true });
  }
  c.executionCtx.waitUntil(notifyOthers(c.env, u, 'Bills', `${u.name} paid ${bill.name}`));
  return c.json(await c.env.DB.prepare('SELECT * FROM bills WHERE id = ?').bind(bill.id).first());
});

// Add a recipe's ingredients to the shopping list, skipping items already on the list.
app.post('/api/recipes/:id/to-shopping', async (c) => {
  const u = c.get('user');
  const recipe = await c.env.DB.prepare('SELECT * FROM recipes WHERE id = ? AND household_id = ?')
    .bind(c.req.param('id'), u.household_id).first<{ ingredients: string; title: string }>();
  if (!recipe) return bad('Not found.', 404);
  let items: string[] = [];
  try { items = JSON.parse(recipe.ingredients); } catch { items = []; }
  const open = new Set(((await c.env.DB.prepare('SELECT name FROM shopping_items WHERE household_id = ? AND checked = 0')
    .bind(u.household_id).all<{ name: string }>()).results).map((r) => r.name.toLowerCase()));
  const fresh = items.map((s) => s.trim()).filter((s) => s && !open.has(s.toLowerCase()));
  if (fresh.length) {
    await c.env.DB.batch(fresh.map((name) => c.env.DB.prepare(
      'INSERT INTO shopping_items (id, household_id, name, aisle, checked, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
    ).bind(uid('i_'), u.household_id, name, guessAisle(name), u.id, now(), now())));
    c.executionCtx.waitUntil(notifyOthers(c.env, u, 'Shopping list', `${u.name} added ${fresh.length} items for ${recipe.title}`));
  }
  return c.json({ added: fresh.length });
});

app.post('/api/shopping_items/clear-checked', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM shopping_items WHERE household_id = ? AND checked = 1').bind(c.get('user').household_id).run();
  return c.json({ deleted: r.meta.changes });
});

// ---------- Generic list / create / update / delete ----------

app.get('/api/:table', async (c) => {
  const table = c.req.param('table');
  if (!TABLES[table]) return bad('Unknown list.', 404);
  const u = c.get('user');
  const q = c.req.query();
  let sql = `SELECT * FROM ${table} WHERE household_id = ?`;
  const args: unknown[] = [u.household_id];
  if (q.from && ['meals', 'events'].includes(table)) { sql += ' AND date >= ?'; args.push(q.from); }
  if (q.to && ['meals', 'events'].includes(table)) { sql += ' AND date <= ?'; args.push(q.to); }
  if (q.list && table === 'wishes') { sql += ' AND list = ?'; args.push(q.list); }
  sql += ' ORDER BY ' + ({
    shopping_items: 'checked, aisle, created_at',
    recipes: 'title COLLATE NOCASE',
    meals: 'date, slot',
    chores: 'done_at IS NOT NULL, due_date IS NULL, due_date, created_at',
    events: 'date, start_time',
    bills: 'due_date',
    wishes: "status = 'done', created_at DESC",
  } as Record<string, string>)[table];
  return c.json((await c.env.DB.prepare(sql).bind(...args).all()).results);
});

function pick(table: string, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const col of TABLES[table]) if (col in body) {
    let v = body[col];
    if (col === 'ingredients' && Array.isArray(v)) v = JSON.stringify(v);
    if (col === 'checked') v = v ? 1 : 0;
    if (typeof v === 'string') v = v.trim();
    out[col] = v === '' ? null : v;
  }
  return out;
}

app.post('/api/:table', async (c) => {
  const table = c.req.param('table');
  if (!TABLES[table]) return bad('Unknown list.', 404);
  const u = c.get('user');
  const data = pick(table, await c.req.json());
  for (const r of REQUIRED[table]) if (data[r] == null) return bad(`Missing ${r}.`);
  if (table === 'shopping_items' && !data.aisle) data.aisle = guessAisle(String(data.name));
  if (['shopping_items', 'wishes'].includes(table)) data.added_by = u.id;
  const id = uid(table[0] + '_');
  const row = { id, household_id: u.household_id, ...data, created_at: now(), updated_at: now() };
  const cols = Object.keys(row);
  await c.env.DB.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(...Object.values(row)).run();
  const saved = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  const d = describe[table]?.(saved!);
  if (d) c.executionCtx.waitUntil(notifyOthers(c.env, u, d[0], `${u.name} ${d[1]}`, { table }));
  return c.json(saved, 201);
});

app.patch('/api/:table/:id', async (c) => {
  const table = c.req.param('table');
  if (!TABLES[table]) return bad('Unknown list.', 404);
  const u = c.get('user');
  const data = pick(table, await c.req.json());
  if (!Object.keys(data).length) return bad('Nothing to update.');
  data.updated_at = now();
  const cols = Object.keys(data);
  const r = await c.env.DB.prepare(`UPDATE ${table} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND household_id = ?`)
    .bind(...Object.values(data), c.req.param('id'), u.household_id).run();
  if (!r.meta.changes) return bad('Not found.', 404);
  return c.json(await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(c.req.param('id')).first());
});

app.delete('/api/:table/:id', async (c) => {
  const table = c.req.param('table');
  if (!TABLES[table]) return bad('Unknown list.', 404);
  const r = await c.env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND household_id = ?`)
    .bind(c.req.param('id'), c.get('user').household_id).run();
  if (!r.meta.changes) return bad('Not found.', 404);
  return c.json({ ok: true });
});

app.onError((err) => {
  console.error(err);
  return bad('Something went wrong on the server.', 500);
});

// ---------- Daily 7am reminder ----------

async function morningReminders(env: Env) {
  const today = localDate(tz(env));
  const soon = addDays(today, 3);
  const users = (await env.DB.prepare('SELECT id, household_id, name FROM users').all<{ id: string; household_id: string; name: string }>()).results;
  const msgs: PushMsg[] = [];
  for (const user of users) {
    const tokens = (await env.DB.prepare('SELECT token FROM push_tokens WHERE user_id = ?').bind(user.id).all<{ token: string }>()).results;
    if (!tokens.length) continue;
    const [events, chores, bills] = await env.DB.batch([
      env.DB.prepare("SELECT title, start_time FROM events WHERE household_id = ? AND date = ? AND who IN ('both', ?) ORDER BY start_time").bind(user.household_id, today, user.id),
      env.DB.prepare('SELECT title FROM chores WHERE household_id = ? AND done_at IS NULL AND due_date <= ? AND (assignee_id IS NULL OR assignee_id = ?)').bind(user.household_id, today, user.id),
      env.DB.prepare('SELECT name, due_date FROM bills WHERE household_id = ? AND due_date <= ?').bind(user.household_id, soon),
    ]);
    const parts: string[] = [];
    if (events.results.length) parts.push(`${events.results.length} on the calendar`);
    if (chores.results.length) parts.push(`${chores.results.length} chore${chores.results.length > 1 ? 's' : ''} due`);
    if (bills.results.length) parts.push(`${bills.results.length} bill${bills.results.length > 1 ? 's' : ''} due soon`);
    if (!parts.length) continue;
    for (const t of tokens) msgs.push({ to: t.token, title: `Morning ${user.name}`, body: parts.join(', '), data: { screen: 'today' } });
  }
  await sendPush(msgs);
  // Tidy expired sessions.
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()).run();
}

export default {
  fetch: app.fetch,
  scheduled: (_e: ScheduledController, env: Env, ctx: ExecutionContext) => ctx.waitUntil(morningReminders(env)),
};

export { morningReminders };
