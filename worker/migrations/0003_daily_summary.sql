-- Hour of the day (Brisbane time) for each person's daily calendar notification. NULL turns it off.
ALTER TABLE users ADD COLUMN notify_hour INTEGER DEFAULT 7;
