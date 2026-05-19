CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM (
      'pending_schedule',
      'scheduled',
      'new',
      'assigned',
      'acknowledged',
      'in_transit',
      'in_process',
      'needs_revisit',
      'revisit_scheduled',
      'completed',
      'resolved',
      'resolved_on_revisit',
      'cancellation_requested',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_type') THEN
    CREATE TYPE job_type AS ENUM ('installation', 'complaint');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_source') THEN
    CREATE TYPE job_source AS ENUM ('direct', 'via_dealer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_cancellation_request_status') THEN
    CREATE TYPE job_cancellation_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS virtual_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  is_frequent BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  vcid UUID NOT NULL REFERENCES virtual_customers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, phone, vcid)
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  type job_type NOT NULL,
  status job_status NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  source job_source NOT NULL,
  dealer_id UUID REFERENCES dealers(id) ON DELETE RESTRICT,
  vcid UUID NOT NULL REFERENCES virtual_customers(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  issue_description TEXT,
  installation_notes TEXT,
  scheduled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  is_repeat BOOLEAN NOT NULL DEFAULT FALSE,
  is_frequent BOOLEAN NOT NULL DEFAULT FALSE,
  is_chronic BOOLEAN NOT NULL DEFAULT FALSE,
  repeat_window_days_used INT,
  frequent_threshold_used INT,
  frequent_window_used INT,
  version INT NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_dealer_source CHECK (source <> 'via_dealer' OR dealer_id IS NOT NULL),
  CONSTRAINT chk_cancel_meta CHECK (
    cancelled_at IS NULL OR (cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL)
  ),
  CONSTRAINT chk_cancel_order CHECK (cancelled_at IS NULL OR cancelled_at >= created_at),
  CONSTRAINT chk_issue_for_installation CHECK (
    type <> 'installation' OR issue_description IS NULL
  ),
  CONSTRAINT chk_installation_fields_for_complaint CHECK (
    type <> 'complaint' OR installation_notes IS NULL
  )
);

CREATE TABLE IF NOT EXISTS job_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  notes TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status job_cancellation_request_status NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_decision_meta CHECK (
    status = 'pending' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)
  ),
  CONSTRAINT chk_decided_order CHECK (
    decided_at IS NULL OR decided_at >= requested_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cancel_req_one_pending
  ON job_cancellation_requests (job_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS job_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_vcid_created
  ON jobs (organization_id, vcid, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_status_type
  ON jobs (organization_id, status, type)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_dealer
  ON jobs (organization_id, dealer_id, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_brand
  ON jobs (organization_id, brand_id);

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled
  ON jobs (organization_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_jobs_is_chronic
  ON jobs (organization_id, is_chronic)
  WHERE is_chronic = TRUE;

CREATE INDEX IF NOT EXISTS idx_jobs_not_deleted
  ON jobs (organization_id, id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_customer_phones_lookup
  ON customer_phones (organization_id, phone)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_virtual_customers_name_addr
  ON virtual_customers (organization_id, customer_name, address)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_timeline_org_job
  ON job_timeline (organization_id, job_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION validate_job_status_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'installation' THEN
    IF NEW.status NOT IN (
      'pending_schedule',
      'scheduled',
      'assigned',
      'acknowledged',
      'in_transit',
      'in_process',
      'completed',
      'cancelled'
    ) THEN
      RAISE EXCEPTION 'Invalid installation status: %', NEW.status;
    END IF;
  ELSIF NEW.type = 'complaint' THEN
    IF NEW.status NOT IN (
      'new',
      'assigned',
      'acknowledged',
      'in_transit',
      'in_process',
      'resolved',
      'needs_revisit',
      'revisit_scheduled',
      'resolved_on_revisit',
      'cancellation_requested',
      'cancelled'
    ) THEN
      RAISE EXCEPTION 'Invalid complaint status: %', NEW.status;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid job type: %', NEW.type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_job_status ON jobs;
CREATE TRIGGER trg_validate_job_status
BEFORE INSERT OR UPDATE OF status, type
ON jobs
FOR EACH ROW
EXECUTE FUNCTION validate_job_status_fn();
