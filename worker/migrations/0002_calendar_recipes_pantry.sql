-- Calendar colours and repeating events
ALTER TABLE events ADD COLUMN color TEXT;
ALTER TABLE events ADD COLUMN repeat TEXT NOT NULL DEFAULT 'none';
ALTER TABLE events ADD COLUMN repeat_until TEXT;
ALTER TABLE events ADD COLUMN exdates TEXT NOT NULL DEFAULT '[]';

-- Richer recipes (photo, method, where it came from)
ALTER TABLE recipes ADD COLUMN image_url TEXT;
ALTER TABLE recipes ADD COLUMN instructions TEXT;
ALTER TABLE recipes ADD COLUMN servings TEXT;
ALTER TABLE recipes ADD COLUMN source TEXT;
ALTER TABLE recipes ADD COLUMN source_id TEXT;

-- Shopping items can say what they are for
ALTER TABLE shopping_items ADD COLUMN note TEXT;

-- What we already have at home
CREATE TABLE pantry_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qty TEXT,
  location TEXT NOT NULL DEFAULT 'Pantry',
  added_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_pantry_h ON pantry_items(household_id);
