-- Structured unit details on job_units.
-- Previously the creation form concatenated model + unit type into `label` and
-- used a count to duplicate identical rows. Tonnage replaces that count, so one
-- row is now exactly one physical unit and the parts stay separately queryable.
-- `label` is kept (still NOT NULL) as a derived display string for old rows.
ALTER TABLE job_units
  ADD COLUMN IF NOT EXISTS model        TEXT,
  ADD COLUMN IF NOT EXISTS unit_type    TEXT,
  ADD COLUMN IF NOT EXISTS tonnage      NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS serial_outer TEXT,
  ADD COLUMN IF NOT EXISTS serial_inner TEXT;

-- Tonnage is a fixed catalogue (1 to 4 in half-ton steps), not free numeric input.
-- Nullable so pre-existing rows, which have no tonnage, remain valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_units_tonnage'
  ) THEN
    ALTER TABLE job_units
      ADD CONSTRAINT chk_job_units_tonnage
      CHECK (tonnage IS NULL OR tonnage IN (1, 1.5, 2, 2.5, 3, 3.5, 4));
  END IF;
END $$;
