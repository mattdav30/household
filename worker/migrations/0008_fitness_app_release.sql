-- The latest installable Tandem build. The app compares this with its own version
-- and offers a one tap install when a newer build exists.
CREATE TABLE fit_app_release (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL,
  url TEXT NOT NULL,
  notes TEXT,
  updated_at INTEGER NOT NULL
);
INSERT INTO fit_app_release (id, version, url, notes, updated_at)
VALUES (1, '1.1.0', 'https://expo.dev/artifacts/eas/HtkyW3DynfmlmvDRIXEYzc0MYaGjzsVeP8YmVC7HUWk.apk', 'Samsung Health sync, gallery photos, 3D dog', 0);
