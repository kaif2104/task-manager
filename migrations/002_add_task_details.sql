ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS due_date DATE;
