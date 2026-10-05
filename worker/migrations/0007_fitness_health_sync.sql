-- Sessions imported from Samsung Health through Health Connect. external_id stops the same session importing twice.
ALTER TABLE fit_workouts ADD COLUMN source TEXT;
ALTER TABLE fit_workouts ADD COLUMN external_id TEXT;
CREATE UNIQUE INDEX idx_fit_workouts_ext ON fit_workouts(user_id, external_id) WHERE external_id IS NOT NULL;
