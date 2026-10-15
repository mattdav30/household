-- GPS routes for tracked walks and runs, one row per workout row (a walk together has two).
-- polyline: Google polyline text per stretch between pauses, joined with spaces.
-- splits: JSON array of seconds per kilometre.
CREATE TABLE fit_routes (
  workout_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  moving_s INTEGER NOT NULL,
  climb_m INTEGER NOT NULL DEFAULT 0,
  polyline TEXT NOT NULL,
  splits TEXT NOT NULL DEFAULT '[]',
  started_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX fit_routes_household ON fit_routes (household_id);
