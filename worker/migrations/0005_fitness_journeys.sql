-- Road to Tokyo becomes the first of many journeys. Each journey has its own route, dates and rewards.
-- The fitness tables were empty when this ran, so rewards move to a journey keyed table.

CREATE TABLE fit_journeys (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  route TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  finished_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_fit_journeys_h ON fit_journeys(household_id, finished_at);

DROP TABLE fit_rewards;
CREATE TABLE fit_rewards (
  journey_id TEXT NOT NULL,
  stop INTEGER NOT NULL,
  title TEXT NOT NULL,
  claimed_at INTEGER,
  PRIMARY KEY (journey_id, stop)
);

-- start_date now means "training since", which drives how hard workouts get.
-- wedding_date becomes a general countdown with its own label.
ALTER TABLE fit_settings ADD COLUMN countdown_label TEXT NOT NULL DEFAULT 'the wedding';
ALTER TABLE fit_settings ADD COLUMN jar_label TEXT NOT NULL DEFAULT 'a gym membership';
