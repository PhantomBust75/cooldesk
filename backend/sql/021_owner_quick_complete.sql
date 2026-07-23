-- Owner Quick-Complete: lets an owner complete an eligible job directly from
-- the owner portal, skipping interim states. Records which path a job was
-- completed through so metrics/exports can tell them apart.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS completed_via TEXT,
  ADD COLUMN IF NOT EXISTS completed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ,
  ADD CONSTRAINT chk_jobs_completed_via CHECK (
    completed_via IS NULL OR completed_via IN ('technician_flow', 'owner_quick_complete')
  );
