-- Phase 07: Notifications, repeat alerts, and owner dashboard

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS chk_recipient;
ALTER TABLE notifications
  ADD CONSTRAINT chk_recipient
  CHECK (recipient_user_id IS NOT NULL OR recipient_dealer_id IS NOT NULL);

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS chk_read_meta;
ALTER TABLE notifications
  ADD CONSTRAINT chk_read_meta
  CHECK (is_read = FALSE OR read_at IS NOT NULL);

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS chk_single_recipient_channel;
ALTER TABLE notifications
  ADD CONSTRAINT chk_single_recipient_channel
  CHECK (
    (recipient_user_id IS NOT NULL AND recipient_dealer_id IS NULL)
    OR (recipient_user_id IS NULL AND recipient_dealer_id IS NOT NULL)
  );

DROP INDEX IF EXISTS idx_notifications_dedup_user_event_job;
DROP INDEX IF EXISTS idx_notif_dedup_user_job;
DROP INDEX IF EXISTS idx_notif_dedup_user_nojob;
DROP INDEX IF EXISTS idx_notif_dedup_dealer_job;
DROP INDEX IF EXISTS idx_notif_dedup_dealer_nojob;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup_user_job
  ON notifications (organization_id, event_type, job_id, recipient_user_id)
  WHERE recipient_user_id IS NOT NULL AND job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup_user_nojob
  ON notifications (organization_id, event_type, recipient_user_id)
  WHERE recipient_user_id IS NOT NULL AND job_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup_dealer_job
  ON notifications (organization_id, event_type, job_id, recipient_dealer_id)
  WHERE recipient_dealer_id IS NOT NULL AND job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup_dealer_nojob
  ON notifications (organization_id, event_type, recipient_dealer_id)
  WHERE recipient_dealer_id IS NOT NULL AND job_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
  ON notifications (organization_id, recipient_user_id, is_read, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_dealer_inbox
  ON notifications (organization_id, recipient_dealer_id, is_read, created_at DESC)
  WHERE recipient_dealer_id IS NOT NULL;

ALTER TABLE virtual_customers
  ADD COLUMN IF NOT EXISTS frequent_flagged_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS analytics_business_daily (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  metric_date DATE NOT NULL,
  jobs_total INT NOT NULL DEFAULT 0,
  jobs_completed INT NOT NULL DEFAULT 0,
  jobs_resolved INT NOT NULL DEFAULT 0,
  jobs_cancelled INT NOT NULL DEFAULT 0,
  repeat_complaints INT NOT NULL DEFAULT 0,
  frequent_complaints INT NOT NULL DEFAULT 0,
  revenue_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, metric_date)
);

CREATE TABLE IF NOT EXISTS analytics_technician_daily (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  metric_date DATE NOT NULL,
  technician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  jobs_assigned INT NOT NULL DEFAULT 0,
  jobs_completed INT NOT NULL DEFAULT 0,
  jobs_resolved INT NOT NULL DEFAULT 0,
  no_show_count INT NOT NULL DEFAULT 0,
  on_time_count INT NOT NULL DEFAULT 0,
  late_count INT NOT NULL DEFAULT 0,
  avg_star_rating NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, metric_date, technician_id)
);

CREATE TABLE IF NOT EXISTS analytics_brand_daily (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  metric_date DATE NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  jobs_total INT NOT NULL DEFAULT 0,
  jobs_completed INT NOT NULL DEFAULT 0,
  jobs_resolved INT NOT NULL DEFAULT 0,
  jobs_cancelled INT NOT NULL DEFAULT 0,
  repeat_complaints INT NOT NULL DEFAULT 0,
  frequent_complaints INT NOT NULL DEFAULT 0,
  revenue_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, metric_date, brand_id)
);

CREATE TABLE IF NOT EXISTS analytics_dealer_daily (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  metric_date DATE NOT NULL,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE RESTRICT,
  jobs_submitted INT NOT NULL DEFAULT 0,
  jobs_cancelled INT NOT NULL DEFAULT 0,
  jobs_resolved INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, metric_date, dealer_id)
);

CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  star_rating INT NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  review_text TEXT,
  is_low_rated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_business_org_date
  ON analytics_business_daily (organization_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_technician_org_date
  ON analytics_technician_daily (organization_id, metric_date DESC, technician_id);

CREATE INDEX IF NOT EXISTS idx_analytics_brand_org_date
  ON analytics_brand_daily (organization_id, metric_date DESC, brand_id);

CREATE INDEX IF NOT EXISTS idx_analytics_dealer_org_date
  ON analytics_dealer_daily (organization_id, metric_date DESC, dealer_id);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_org_low_rated
  ON customer_reviews (organization_id, is_low_rated, created_at DESC)
  WHERE is_low_rated = TRUE;
