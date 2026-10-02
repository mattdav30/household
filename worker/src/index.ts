import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  uid, inviteCode, hashPassword, safeEqual, now, localDate, addDays, advance, guessAisle, sendPush, PushMsg,
} from './lib';
import { expandEvents } from './recur';
import { byReadiness, coverage, fromMealDb, importFromUrl, isBasic, mealDb, normIngredients, sameThing, type Ingredient } from './food';

type Env = { DB: D1Database; TZ_OFFSET_MIN: string };
type User = { id: string; household_id: string; email: string; name: string; color: string };
type Vars = { user: User };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();
app.use('*', cors());

const SESSION_DAYS = 365;
const tz = (env: Env) => Number(env.TZ_OFFSET_MIN ?? 600);

// Columns each table accepts from the app. Anything else is ignored.
const TABLES: Record<string, string[]> = {
  shopping_items: ['name', 'qty', 'aisle', 'checked', 'note'],
  recipes: ['title', 'ingredients', 'url', 'notes', 'image_url', 'instructions', 'servings', 'source', 'source_id'],
  pantry_items: ['name', 'qty', 'location'],
  meals: ['date', 'slot', 'title', 'recipe_id', 'notes'],
  chores: ['title', 'assignee_id', 'due_date', 'repeat', 'done_at', 'notes'],
  events: ['title', 'date', 'start_time', 'end_time', 'who', 'location', 'notes', 'color', 'repeat', 'repeat_until', 'exdates'],
  bills: ['name', 'amount_cents', 'due_date', 'repeat', 'last_paid_at', 'notes'],
  wishes: ['list', 'title', 'url', 'price_cents', 'for_whom', 'status', 'notes'],
};
const REQUIRED: Record<string, string[]> = {
  shopping_items: ['name'], recipes: ['title'], pantry_items: ['name'], meals: ['date', 'title'], chores: ['title'],
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

// Public check that the online recipe library is reachable. Returns counts only.
app.get('/health/recipes', async (c) => {
  try {
    const cats = await mealDb('/categories.php', c.executionCtx);
    const hits = await mealDb('/search.php?s=chicken', c.executionCtx);
    return c.json({ ok: true, categories: cats.categories?.length ?? 0, chicken: hits.meals?.length ?? 0, sample: hits.meals?.[0] ? fromMealDb(hits.meals[0]).ingredients.slice(0, 3) : null });
  } catch (e) { return c.json({ ok: false, error: (e as Error).message }, 502); }
});

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
  pantry_items: () => null,
  recipes: () => null,
};

// ---------- Special actions ----------

// Repeating events are stored once and expanded into dates on the way out.
async function eventsBetween(db: D1Database, householdId: string, from: string, to: string) {
  const rows = (await db.prepare(
    `SELECT * FROM events WHERE household_id = ? AND date <= ?
     AND ((repeat = 'none' AND date >= ?) OR (repeat != 'none' AND (repeat_until IS NULL OR repeat_until >= ?)))`,
  ).bind(householdId, to, from, from).all<Record<string, any>>()).results;
  return expandEvents(rows as any[], from, to);
}

app.get('/api/today', async (c) => {
  const u = c.get('user');
  const today = localDate(tz(c.env));
  const week = addDays(today, 7);
  const db = c.env.DB;
  const [meals, chores, bills, shopping, pantry] = await db.batch([
    db.prepare('SELECT m.*, r.image_url FROM meals m LEFT JOIN recipes r ON r.id = m.recipe_id WHERE m.household_id = ? AND m.date = ? ORDER BY m.slot').bind(u.household_id, today),
    db.prepare('SELECT * FROM chores WHERE household_id = ? AND done_at IS NULL AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date').bind(u.household_id, today),
    db.prepare('SELECT * FROM bills WHERE household_id = ? AND due_date <= ? ORDER BY due_date').bind(u.household_id, week),
    db.prepare('SELECT COUNT(*) AS n FROM shopping_items WHERE household_id = ? AND checked = 0').bind(u.household_id),
    db.prepare('SELECT COUNT(*) AS n FROM pantry_items WHERE household_id = ?').bind(u.household_id),
  ]);
  return c.json({
    today,
    events: await eventsBetween(db, u.household_id, today, addDays(today, 2)),
    meals: meals.results,
    chores: chores.results,
    bills: bills.results,
    shopping_open: (shopping.results[0] as { n: number }).n,
    pantry_count: (pantry.results[0] as { n: number }).n,
  });
});

app.get('/api/events', async (c) => {
  const from = c.req.query('from') ?? localDate(tz(c.env));
  const to = c.req.query('to') ?? addDays(from, 42);
  return c.json(await eventsBetween(c.env.DB, c.get('user').household_id, from, to));
});

// Remove one date from a repeating event, leaving the rest of the series.
app.post('/api/events/:id/skip', async (c) => {
  const u = c.get('user');
  const { date } = await c.req.json<{ date?: string }>();
  const ev = await c.env.DB.prepare('SELECT exdates FROM events WHERE id = ? AND household_id = ?')
    .bind(c.req.param('id'), u.household_id).first<{ exdates: string }>();
  if (!ev || !date) return bad('Not found.', 404);
  let ex: string[] = [];
  try { ex = JSON.parse(ev.exdates || '[]'); } catch { ex = []; }
  if (!ex.includes(date)) ex.push(date);
  await c.env.DB.prepare('UPDATE events SET exdates = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(ex), now(), c.req.param('id')).run();
  return c.json({ ok: true });
});

// ---------- Online recipes ----------

app.get('/api/discover/categories', async (c) => {
  const data = await mealDb('/categories.php', c.executionCtx);
  return c.json((data.categories ?? []).map((x: any) => ({ name: x.strCategory, image_url: x.strCategoryThumb })));
});

app.get('/api/discover/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const cat = (c.req.query('c') ?? '').trim();
  try {
    if (cat) {
      const data = await mealDb('/filter.php?c=' + encodeURIComponent(cat), c.executionCtx);
      return c.json((data.meals ?? []).map((m: any) => ({ id: 'mealdb:' + m.idMeal, title: m.strMeal, image_url: m.strMealThumb, category: cat })));
    }
    if (!q) {
      // A mixed starter shelf: a few random picks.
      const picks = await Promise.all(Array.from({ length: 8 }, () => fetch('https://www.themealdb.com/api/json/v1/1/random.php').then((r) => r.json() as Promise<any>).catch(() => null)));
      const seen = new Set<string>();
      return c.json(picks.flatMap((p) => p?.meals ?? []).filter((m: any) => !seen.has(m.idMeal) && seen.add(m.idMeal))
        .map((m: any) => ({ id: 'mealdb:' + m.idMeal, title: m.strMeal, image_url: m.strMealThumb, category: m.strCategory })));
    }
    // Search by name, then by main ingredient, and merge.
    const [byName, byIng] = await Promise.all([
      mealDb('/search.php?s=' + encodeURIComponent(q), c.executionCtx),
      mealDb('/filter.php?i=' + encodeURIComponent(q.replace(/\s+/g, '_')), c.executionCtx).catch(() => ({ meals: null })),
    ]);
    const seen = new Set<string>();
    const out = [...(byName.meals ?? []), ...(byIng.meals ?? [])].filter((m: any) => !seen.has(m.idMeal) && seen.add(m.idMeal))
      .map((m: any) => ({ id: 'mealdb:' + m.idMeal, title: m.strMeal, image_url: m.strMealThumb, category: m.strCategory ?? null }));
    return c.json(out);
  } catch (e) {
    return bad((e as Error).message, 502);
  }
});

app.get('/api/discover/meal/:id', async (c) => {
  const id = c.req.param('id').replace(/^mealdb:/, '');
  const data = await mealDb('/lookup.php?i=' + encodeURIComponent(id), c.executionCtx);
  const m = data.meals?.[0];
  if (!m) return bad('Recipe not found.', 404);
  return c.json(fromMealDb(m));
});

app.post('/api/discover/import', async (c) => {
  const { url } = await c.req.json<{ url?: string }>();
  if (!url || !/^https?:\/\//i.test(url.trim())) return bad('Paste a full link starting with https://');
  try {
    return c.json(await importFromUrl(url.trim()));
  } catch (e) {
    return bad((e as Error).message, 422);
  }
});

// ---------- Have, on the list, or need ----------

app.post('/api/ingredients/check', async (c) => {
  const u = c.get('user');
  const body = await c.req.json<{ items?: unknown }>();
  const items = normIngredients(body.items ?? []);
  const [pantry, listed] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT name, qty, location FROM pantry_items WHERE household_id = ?').bind(u.household_id),
    c.env.DB.prepare('SELECT name, qty FROM shopping_items WHERE household_id = ? AND checked = 0').bind(u.household_id),
  ]);
  return c.json(items.map((i) => {
    if (isBasic(i.name)) return { ...i, status: 'have', match: 'basic' };
    const have = (pantry.results as { name: string; location: string }[]).find((p) => sameThing(p.name, i.name));
    if (have) return { ...i, status: 'have', match: have.name, location: have.location };
    const onList = (listed.results as { name: string }[]).find((p) => sameThing(p.name, i.name));
    if (onList) return { ...i, status: 'listed', match: onList.name };
    return { ...i, status: 'need' };
  }));
});

app.post('/api/shopping_items/bulk', async (c) => {
  const u = c.get('user');
  const body = await c.req.json<{ items?: (Ingredient & { note?: string })[] }>();
  const items = (body.items ?? []).filter((i) => i?.name?.trim());
  const open = (await c.env.DB.prepare('SELECT name FROM shopping_items WHERE household_id = ? AND checked = 0')
    .bind(u.household_id).all<{ name: string }>()).results;
  const fresh = items.filter((i) => !open.some((o) => sameThing(o.name, i.name))).map((i) => ({ ...i, id: uid('i_') }));
  if (fresh.length) {
    await c.env.DB.batch(fresh.map((i) => c.env.DB.prepare(
      'INSERT INTO shopping_items (id, household_id, name, qty, aisle, checked, added_by, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
    ).bind(i.id, u.household_id, i.name.trim(), i.qty ?? null, guessAisle(i.name), u.id, i.note ?? null, now(), now())));
    c.executionCtx.waitUntil(notifyOthers(c.env, u, 'Shopping list', `${u.name} added ${fresh.length} item${fresh.length > 1 ? 's' : ''}`, { table: 'shopping_items' }));
  }
  return c.json({ added: fresh.length, skipped: items.length - fresh.length, ids: fresh.map((i) => i.id) });
});

// ---------- At home ----------

const HOME_FOR_AISLE: Record<string, string> = {
  Produce: 'Fridge', 'Meat & Seafood': 'Fridge', 'Dairy & Eggs': 'Fridge', Frozen: 'Freezer', Household: 'Household',
};

app.post('/api/pantry_items/:id/used-up', async (c) => {
  const u = c.get('user');
  const { add_to_list } = await c.req.json<{ add_to_list?: boolean }>().catch(() => ({ add_to_list: false }));
  const item = await c.env.DB.prepare('SELECT * FROM pantry_items WHERE id = ? AND household_id = ?')
    .bind(c.req.param('id'), u.household_id).first<{ name: string }>();
  if (!item) return bad('Not found.', 404);
  const stmts = [c.env.DB.prepare('DELETE FROM pantry_items WHERE id = ?').bind(c.req.param('id'))];
  if (add_to_list) {
    const open = (await c.env.DB.prepare('SELECT name FROM shopping_items WHERE household_id = ? AND checked = 0').bind(u.household_id).all<{ name: string }>()).results;
    if (!open.some((o) => sameThing(o.name, item.name))) {
      stmts.push(c.env.DB.prepare('INSERT INTO shopping_items (id, household_id, name, aisle, checked, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)')
        .bind(uid('i_'), u.household_id, item.name, guessAisle(item.name), u.id, now(), now()));
      c.executionCtx.waitUntil(notifyOthers(c.env, u, 'Shopping list', `${u.name} ran out of ${item.name}`, { table: 'shopping_items' }));
    }
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
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

async function homeLists(db: D1Database, householdId: string) {
  const [pantry, open] = await db.batch([
    db.prepare('SELECT name, location FROM pantry_items WHERE household_id = ?').bind(householdId),
    db.prepare('SELECT name FROM shopping_items WHERE household_id = ? AND checked = 0').bind(householdId),
  ]);
  return {
    pantry: (pantry.results as { name: string; location: string }[]),
    listed: (open.results as { name: string }[]).map((r) => r.name),
  };
}

// Add the ingredients we lack to the shopping list, skipping what we have or have listed already.
app.post('/api/recipes/:id/to-shopping', async (c) => {
  const u = c.get('user');
  const body = await c.req.json<{ note?: string }>().catch(() => ({} as { note?: string }));
  const recipe = await c.env.DB.prepare('SELECT * FROM recipes WHERE id = ? AND household_id = ?')
    .bind(c.req.param('id'), u.household_id).first<{ ingredients: string; title: string }>();
  if (!recipe) return bad('Not found.', 404);
  const items = normIngredients(recipe.ingredients);
  const { pantry, listed } = await homeLists(c.env.DB, u.household_id);
  const known = [...pantry.map((p) => p.name), ...listed];
  const note = body.note?.trim() || recipe.title;
  const fresh = items.filter((i) => !isBasic(i.name) && !known.some((k) => sameThing(k, i.name))).map((i) => ({ ...i, id: uid('i_') }));
  if (fresh.length) {
    await c.env.DB.batch(fresh.map((i) => c.env.DB.prepare(
      'INSERT INTO shopping_items (id, household_id, name, qty, aisle, checked, added_by, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
    ).bind(i.id, u.household_id, i.name, i.qty, guessAisle(i.name), u.id, note, now(), now())));
    c.executionCtx.waitUntil(notifyOthers(c.env, u, 'Shopping list', `${u.name} added ${fresh.length} item${fresh.length > 1 ? 's' : ''} for ${note}`, { table: 'shopping_items' }));
  }
  return c.json({ added: fresh.length, ids: fresh.map((i) => i.id), names: fresh.map((i) => i.name) });
});

// Undo a bulk add: removes those items if nobody has ticked them yet.
app.post('/api/shopping_items/remove-many', async (c) => {
  const u = c.get('user');
  const { ids } = await c.req.json<{ ids?: string[] }>();
  if (!ids?.length) return c.json({ deleted: 0 });
  const r = await c.env.DB.prepare(`DELETE FROM shopping_items WHERE household_id = ? AND checked = 0 AND id IN (${ids.map(() => '?').join(',')})`)
    .bind(u.household_id, ...ids.slice(0, 100)).run();
  return c.json({ deleted: r.meta.changes });
});

// How ready each saved recipe is, given what is at home and on the list.
app.get('/api/recipes/coverage', async (c) => {
  const u = c.get('user');
  const recipes = (await c.env.DB.prepare('SELECT id, ingredients FROM recipes WHERE household_id = ?').bind(u.household_id).all<{ id: string; ingredients: string }>()).results;
  const { pantry, listed } = await homeLists(c.env.DB, u.household_id);
  const names = pantry.map((p) => p.name);
  return c.json(Object.fromEntries(recipes.map((r) => [r.id, coverage(normIngredients(r.ingredients), names, listed)])));
});

// Meal ideas ranked by what we already have: saved recipes first, then online recipes built around what is in the fridge.
app.get('/api/suggest', async (c) => {
  const u = c.get('user');
  const { pantry, listed } = await homeLists(c.env.DB, u.household_id);
  const names = pantry.map((p) => p.name);
  const recipes = (await c.env.DB.prepare('SELECT id, title, image_url, ingredients, source, source_id FROM recipes WHERE household_id = ?')
    .bind(u.household_id).all<{ id: string; title: string; image_url: string | null; ingredients: string; source: string | null; source_id: string | null }>()).results;
  const saved = recipes
    .map((r) => ({ id: r.id, title: r.title, image_url: r.image_url, ...coverage(normIngredients(r.ingredients), names, listed) }))
    .filter((r) => r.total > 0)
    .sort(byReadiness);

  // Search the online library by the fresh things we have, fridge and freezer first.
  const order = ['Fridge', 'Freezer', 'Pantry'];
  const seeds = [...pantry].filter((p) => p.location !== 'Household')
    .sort((a, b) => order.indexOf(a.location) - order.indexOf(b.location))
    .map((p) => p.name).slice(0, 5);
  const savedMealIds = new Set(recipes.filter((r) => r.source === 'mealdb').map((r) => 'mealdb:' + r.source_id));
  const hits = new Map<string, { n: number; seed: string[] }>();
  await Promise.all(seeds.map(async (seed) => {
    try {
      const data = await mealDb('/filter.php?i=' + encodeURIComponent(seed.toLowerCase().trim().replace(/\s+/g, '_')), c.executionCtx);
      for (const m of (data.meals ?? []) as { idMeal: string }[]) {
        const h = hits.get(m.idMeal) ?? { n: 0, seed: [] };
        h.n++; h.seed.push(seed); hits.set(m.idMeal, h);
      }
    } catch { /* one failed search does not stop the rest */ }
  }));
  const candidates = [...hits.entries()].filter(([id]) => !savedMealIds.has('mealdb:' + id))
    .sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  const online = (await Promise.all(candidates.map(async ([id, h]) => {
    try {
      const data = await mealDb('/lookup.php?i=' + id, c.executionCtx);
      const m = data.meals?.[0];
      if (!m) return null;
      const r = fromMealDb(m);
      return { id: r.id, title: r.title, image_url: r.image_url, category: r.category, uses: h.seed, ...coverage(r.ingredients, names, listed) };
    } catch { return null; }
  }))).filter((x): x is NonNullable<typeof x> => !!x).sort(byReadiness);

  return c.json({ saved, online, pantry_count: pantry.length });
});

// Done shopping: ticked items leave the list and go into At home.
app.post('/api/shopping_items/clear-checked', async (c) => {
  const u = c.get('user');
  const db = c.env.DB;
  const [ticked, pantry] = await db.batch([
    db.prepare('SELECT * FROM shopping_items WHERE household_id = ? AND checked = 1').bind(u.household_id),
    db.prepare('SELECT id, name FROM pantry_items WHERE household_id = ?').bind(u.household_id),
  ]);
  const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM shopping_items WHERE household_id = ? AND checked = 1').bind(u.household_id)];
  let moved = 0;
  for (const it of ticked.results as { name: string; qty: string | null; aisle: string }[]) {
    const existing = (pantry.results as { id: string; name: string }[]).find((p) => sameThing(p.name, it.name));
    if (existing) {
      stmts.push(db.prepare('UPDATE pantry_items SET qty = COALESCE(?, qty), updated_at = ? WHERE id = ?').bind(it.qty, now(), existing.id));
    } else {
      stmts.push(db.prepare('INSERT INTO pantry_items (id, household_id, name, qty, location, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(uid('p_'), u.household_id, it.name, it.qty, HOME_FOR_AISLE[it.aisle] ?? 'Pantry', u.id, now(), now()));
      moved++;
    }
  }
  await db.batch(stmts);
  return c.json({ deleted: ticked.results.length, moved });
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
    pantry_items: 'location, name COLLATE NOCASE',
  } as Record<string, string>)[table];
  return c.json((await c.env.DB.prepare(sql).bind(...args).all()).results);
});

function pick(table: string, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const col of TABLES[table]) if (col in body) {
    let v = body[col];
    if ((col === 'ingredients' || col === 'exdates') && Array.isArray(v)) v = JSON.stringify(v);
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
  if (['shopping_items', 'wishes', 'pantry_items'].includes(table)) data.added_by = u.id;
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
    const events = { results: (await eventsBetween(env.DB, user.household_id, today, today)).filter((e) => e.who === 'both' || e.who === user.id) };
    const [chores, bills] = await env.DB.batch([
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
