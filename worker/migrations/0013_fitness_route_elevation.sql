-- Height profile and descent for GPS routes, plus total time including pauses.
-- profile: JSON array of [distance metres, height metres] pairs, smoothed, at most 120.
ALTER TABLE fit_routes ADD COLUMN descent_m INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fit_routes ADD COLUMN elapsed_s INTEGER;
ALTER TABLE fit_routes ADD COLUMN profile TEXT NOT NULL DEFAULT '[]';
