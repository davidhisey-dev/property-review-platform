ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS completed_project BOOLEAN;
