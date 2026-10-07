-- The dog's daily needs, Tamagotchi style. Each meter is stored with the time it was last set
-- and fades from there, so nothing needs a timer on the server.
--   food:   filled by moving (every minute logged), drops about 3 an hour
--   energy: drops slowly in the day, refills overnight and during naps
--   clean:  drops slowly and after outdoor sessions; a bath fills it
--   mess:   a little mess appears every few hours until someone scoops it
ALTER TABLE fit_pet ADD COLUMN food REAL NOT NULL DEFAULT 70;
ALTER TABLE fit_pet ADD COLUMN food_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fit_pet ADD COLUMN energy REAL NOT NULL DEFAULT 80;
ALTER TABLE fit_pet ADD COLUMN energy_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fit_pet ADD COLUMN nap_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fit_pet ADD COLUMN clean REAL NOT NULL DEFAULT 90;
ALTER TABLE fit_pet ADD COLUMN clean_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fit_pet ADD COLUMN mess_at INTEGER NOT NULL DEFAULT 0;
UPDATE fit_pet SET food_at = updated_at, energy_at = updated_at, clean_at = updated_at, mess_at = updated_at;
