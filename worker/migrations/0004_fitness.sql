-- Road to Tokyo: the fitness app for the two of you. Shares accounts and households with Household.

-- One row per household: the journey dates, the shared weekly goal, the gym fund and home equipment.
CREATE TABLE fit_settings (
  household_id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  wedding_date TEXT NOT NULL DEFAULT '2027-07-10',
  weekly_goal_min INTEGER NOT NULL DEFAULT 300,
  jar_cents INTEGER NOT NULL DEFAULT 300,
  jar_goal_cents INTEGER NOT NULL DEFAULT 100000,
  equipment TEXT NOT NULL DEFAULT '["mat"]',
  default_stake TEXT NOT NULL DEFAULT 'Loser cooks dinner on Saturday',
  updated_at INTEGER NOT NULL
);

-- Per person: how hard the workouts start, and the daily reminder hour.
CREATE TABLE fit_profiles (
  user_id TEXT PRIMARY KEY,
  level INTEGER NOT NULL DEFAULT 1,
  reminder_hour INTEGER DEFAULT 6,
  updated_at INTEGER NOT NULL
);

-- Every finished session. A session done together writes one row per person with the same group_id.
CREATE TABLE fit_workouts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  group_id TEXT,
  date TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'home',
  title TEXT NOT NULL,
  effort INTEGER NOT NULL DEFAULT 2,
  together INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_fit_workouts_h ON fit_workouts(household_id, date);

-- Tape measure check ins. Photos stay on the phones and never reach the server.
CREATE TABLE fit_measurements (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  waist_cm REAL,
  hips_cm REAL,
  chest_cm REAL,
  arm_cm REAL,
  weight_kg REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_fit_measure_h ON fit_measurements(household_id, user_id, date);

-- The reward the two of you set for each stop on the map.
CREATE TABLE fit_rewards (
  household_id TEXT NOT NULL,
  stop INTEGER NOT NULL,
  title TEXT NOT NULL,
  claimed_at INTEGER,
  PRIMARY KEY (household_id, stop)
);

-- The stake for each week's challenge (weeks start on Monday).
CREATE TABLE fit_challenges (
  household_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  stake TEXT NOT NULL,
  meal_id TEXT,
  PRIMARY KEY (household_id, week_start)
);

-- Money moved into the real gym savings account.
CREATE TABLE fit_jar (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  note TEXT,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_fit_jar_h ON fit_jar(household_id);
