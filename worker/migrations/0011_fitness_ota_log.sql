-- Each phone's update check, so we can see the phones are asking and what they get back.
CREATE TABLE fit_ota_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  runtime TEXT,
  platform TEXT,
  current_id TEXT,
  embedded_id TEXT,
  result TEXT NOT NULL
);
