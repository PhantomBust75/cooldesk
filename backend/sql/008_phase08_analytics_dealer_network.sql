-- Phase 08: Analytics workers and dealer network

CREATE TABLE IF NOT EXISTS analytics_processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  timeline_event_id UUID NOT NULL UNIQUE REFERENCES job_timeline(id) ON DELETE RESTRICT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ape_timeline_event
  ON analytics_processed_events (timeline_event_id);

CREATE INDEX IF NOT EXISTS idx_ape_processed_at
  ON analytics_processed_events (processed_at DESC);

CREATE OR REPLACE FUNCTION fn_purge_analytics_processed_events()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM analytics_processed_events
  WHERE processed_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_validate_technician_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = NEW.technician_id
      AND u.organization_id = NEW.organization_id
      AND u.role = 'technician'
      AND u.is_deleted = FALSE
  ) THEN
    RAISE EXCEPTION 'analytics_technician_daily.technician_id must reference a technician in same org';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_technician_role ON analytics_technician_daily;

CREATE TRIGGER trg_validate_technician_role
BEFORE INSERT OR UPDATE ON analytics_technician_daily
FOR EACH ROW
EXECUTE FUNCTION fn_validate_technician_role();

CREATE TABLE IF NOT EXISTS dealer_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL UNIQUE REFERENCES dealers(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dealer_brands (
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dealer_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_dealer_brands_org_dealer
  ON dealer_brands (organization_id, dealer_id, brand_id);

CREATE INDEX IF NOT EXISTS idx_dealer_brands_org_brand
  ON dealer_brands (organization_id, brand_id, dealer_id);

ALTER TABLE analytics_dealer_daily
  ADD COLUMN IF NOT EXISTS complaints_submitted INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installations_submitted INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resolved_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_resolution_mins NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pending_count INT NOT NULL DEFAULT 0;

ALTER TABLE analytics_technician_daily
  ADD COLUMN IF NOT EXISTS total_payment_collected NUMERIC(12,2) NOT NULL DEFAULT 0;
