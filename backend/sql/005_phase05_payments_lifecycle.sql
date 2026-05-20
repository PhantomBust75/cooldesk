-- Phase 05: Payments lifecycle hardening

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'collected', 'refunded', 'disputed');
  END IF;
END
$$;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS retained_note TEXT,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;

ALTER TABLE payments ALTER COLUMN status DROP DEFAULT;
ALTER TABLE payments ALTER COLUMN status TYPE payment_status USING status::payment_status;
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending'::payment_status;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS chk_void_meta;
ALTER TABLE payments
  ADD CONSTRAINT chk_void_meta
  CHECK (voided_at IS NULL OR (voided_by IS NOT NULL AND void_reason IS NOT NULL));

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS chk_edit_meta;
ALTER TABLE payments
  ADD CONSTRAINT chk_edit_meta
  CHECK (last_edited_at IS NULL OR last_edited_by IS NOT NULL);

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS chk_collected_meta;
ALTER TABLE payments
  ADD CONSTRAINT chk_collected_meta
  CHECK (
    (
      status = 'refunded'
      AND collected_at IS NOT NULL
    )
    OR (
      status = 'collected'
      AND collected_at IS NOT NULL
    )
    OR (
      status = 'disputed'
    )
    OR (
      status = 'pending'
      AND voided_at IS NOT NULL
    )
    OR (
      status = 'pending'
      AND voided_at IS NULL
      AND collected_at IS NULL
    )
  );

CREATE OR REPLACE FUNCTION set_collected_at_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'collected'
     AND (TG_OP = 'INSERT' OR OLD.status <> 'collected')
  THEN
    NEW.collected_at := COALESCE(NEW.collected_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_collected_at ON payments;

CREATE TRIGGER trg_set_collected_at
BEFORE INSERT OR UPDATE OF status
ON payments
FOR EACH ROW
EXECUTE FUNCTION set_collected_at_fn();

CREATE INDEX IF NOT EXISTS idx_payments_org_status
  ON payments (organization_id, status, updated_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_payments_org_job
  ON payments (organization_id, job_id)
  WHERE is_deleted = FALSE;
