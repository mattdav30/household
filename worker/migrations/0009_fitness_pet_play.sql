-- The dog's play side: treats spent, a play meter that fades over two days, and the wardrobe.
-- Treats are earned from movement (one per ten minutes of a session, up to six per session).
CREATE TABLE fit_pet (
  household_id TEXT PRIMARY KEY,
  treats_spent INTEGER NOT NULL DEFAULT 0,
  fun INTEGER NOT NULL DEFAULT 70,
  fun_at INTEGER NOT NULL,
  owned TEXT NOT NULL DEFAULT '[]',
  wearing TEXT,
  best_fetch INTEGER NOT NULL DEFAULT 0,
  best_catch INTEGER NOT NULL DEFAULT 0,
  best_find INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
