-- Your own workouts and every set you log, for personal bests.
-- items: JSON list of { move_id, move_name, track, sets, reps, weight_kg, seconds } as planned.
CREATE TABLE fit_templates (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX fit_templates_household ON fit_templates (household_id);

-- One row per finished set. track says which numbers matter: weight (kg x reps), reps, time (seconds), cardio (seconds and metres).
CREATE TABLE fit_sets (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  move_id TEXT NOT NULL,
  move_name TEXT NOT NULL,
  track TEXT NOT NULL,
  ord INTEGER NOT NULL,
  set_no INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  seconds INTEGER,
  distance_m INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX fit_sets_user_move ON fit_sets (user_id, move_id, date);
CREATE INDEX fit_sets_workout ON fit_sets (workout_id);
