-- The fitness app goes simple: a tracker, a shared pet and small steps that grow over time.
-- Journeys, rewards, the weekly challenge and the fund are gone. Their tables were empty.
DROP TABLE fit_journeys;
DROP TABLE fit_rewards;
DROP TABLE fit_challenges;
DROP TABLE fit_jar;

-- Each person's current step on the ladder and when they reached it.
ALTER TABLE fit_profiles ADD COLUMN step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fit_profiles ADD COLUMN step_since TEXT;
-- Evening nudge when the day's step is still open.
ALTER TABLE fit_profiles ADD COLUMN evening_nudge INTEGER NOT NULL DEFAULT 1;

-- The shared pet. A NULL name means the two of you have not met it yet.
ALTER TABLE fit_settings ADD COLUMN pet_name TEXT;
ALTER TABLE fit_settings ADD COLUMN pet_kind TEXT NOT NULL DEFAULT 'cat';
ALTER TABLE fit_settings ADD COLUMN pet_color TEXT NOT NULL DEFAULT '#F2C96B';
