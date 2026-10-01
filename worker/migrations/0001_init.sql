-- Household app schema (Cloudflare D1 / SQLite)

CREATE TABLE households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1F6F5C',
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE push_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at INTEGER NOT NULL
);

CREATE TABLE shopping_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qty TEXT,
  aisle TEXT NOT NULL DEFAULT 'Other',
  checked INTEGER NOT NULL DEFAULT 0,
  added_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_shopping_h ON shopping_items(household_id);

CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  title TEXT NOT NULL,
  ingredients TEXT NOT NULL DEFAULT '[]',
  url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_recipes_h ON recipes(household_id);

CREATE TABLE meals (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  date TEXT NOT NULL,
  slot TEXT NOT NULL DEFAULT 'dinner',
  title TEXT NOT NULL,
  recipe_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_meals_h ON meals(household_id, date);

CREATE TABLE chores (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  title TEXT NOT NULL,
  assignee_id TEXT,
  due_date TEXT,
  repeat TEXT NOT NULL DEFAULT 'none',
  done_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_chores_h ON chores(household_id, due_date);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  who TEXT NOT NULL DEFAULT 'both',
  location TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_events_h ON events(household_id, date);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER,
  due_date TEXT NOT NULL,
  repeat TEXT NOT NULL DEFAULT 'monthly',
  last_paid_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_bills_h ON bills(household_id, due_date);

CREATE TABLE wishes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  list TEXT NOT NULL DEFAULT 'want',
  title TEXT NOT NULL,
  url TEXT,
  price_cents INTEGER,
  for_whom TEXT,
  added_by TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_wishes_h ON wishes(household_id, list);
