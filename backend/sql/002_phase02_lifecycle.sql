ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE job_cancellation_requests
  ADD COLUMN IF NOT EXISTS status_at_request job_status;

ALTER TABLE job_cancellation_requests
  ADD COLUMN IF NOT EXISTS decision_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_org_status_type
  ON jobs (organization_id, status, type)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_org_technician
  ON jobs (organization_id, technician_id, updated_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_org_dealer
  ON jobs (organization_id, dealer_id, updated_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_org_created
  ON jobs (organization_id, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled
  ON jobs (organization_id, scheduled_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_cancel_req_pending_by_job_org
  ON job_cancellation_requests (organization_id, job_id)
  WHERE status = 'pending';
