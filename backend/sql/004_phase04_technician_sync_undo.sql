-- Phase 04: Technician PWA sync + undo + punctuality/no-show foundation

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_outcome_type') THEN
    CREATE TYPE visit_outcome_type AS ENUM ('on_time', 'late', 'no_show', 'rescheduled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mobile_action_type') THEN
    CREATE TYPE mobile_action_type AS ENUM (
      'status_transition',
      'payment',
      'status_transition+payment'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'collected',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id)
);

CREATE TABLE IF NOT EXISTS revisits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  sequence_number INT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  custom_reason TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, job_id, sequence_number)
);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS actual_arrival TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_outcome visit_outcome_type,
  ADD COLUMN IF NOT EXISTS late_by_minutes INT,
  ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT chk_jobs_late_by_minutes_non_negative CHECK (late_by_minutes IS NULL OR late_by_minutes >= 0);

CREATE TABLE IF NOT EXISTS mobile_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_action_id TEXT NOT NULL,
  action_type mobile_action_type NOT NULL,
  payload JSONB NOT NULL,
  queue_submitted_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, client_action_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_sync_org_job_processed
  ON mobile_sync_events (organization_id, job_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_assignments_my_jobs
  ON job_assignments (organization_id, technician_id, is_active, assigned_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_jobs_org_no_show_scan
  ON jobs (organization_id, scheduled_at, status)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_revisits_org_job_scheduled
  ON revisits (organization_id, job_id, scheduled_at)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_dedup_user_event_job
  ON notifications (organization_id, event_type, job_id, recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;
