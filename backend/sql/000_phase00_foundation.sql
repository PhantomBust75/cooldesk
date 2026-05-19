CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS system_config (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_users_org_active
  ON users (organization_id, is_deleted, is_active);

CREATE INDEX IF NOT EXISTS idx_system_config_org_key
  ON system_config (organization_id, key);

CREATE OR REPLACE FUNCTION seed_system_config(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO system_config (organization_id, key, value)
  VALUES
    (p_org_id, 'repeat_complaint_window_days', '30'),
    (p_org_id, 'frequent_complaint_threshold', '3'),
    (p_org_id, 'frequent_complaint_window_days', '90'),
    (p_org_id, 'punctuality_grace_period_mins', '15'),
    (p_org_id, 'customer_review_mode', 'off'),
    (p_org_id, 'undo_window_seconds', '60'),
    (p_org_id, 'standard_job_duration_mins', '120')
  ON CONFLICT (organization_id, key) DO NOTHING;
END;
$$;