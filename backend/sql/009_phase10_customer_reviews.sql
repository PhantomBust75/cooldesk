-- Phase 10: Customer Reviews
-- Org-scoped review link lifecycle, token-based access, 48-hour expiry, and analytics integration.

ALTER TABLE customer_reviews
  ADD COLUMN IF NOT EXISTS review_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE customer_reviews
SET submitted_at = COALESCE(submitted_at, created_at)
WHERE submitted_at IS NULL
  AND star_rating IS NOT NULL;

UPDATE customer_reviews
SET comment = COALESCE(comment, review_text)
WHERE comment IS NULL;

ALTER TABLE customer_reviews
  ALTER COLUMN review_token SET DEFAULT gen_random_uuid();

UPDATE customer_reviews
SET review_token = gen_random_uuid()
WHERE review_token IS NULL;

ALTER TABLE customer_reviews
  ALTER COLUMN review_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_customer_reviews_review_token_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_customer_reviews_review_token_unique
      ON customer_reviews (review_token);
  END IF;
END $$;

ALTER TABLE customer_reviews
  DROP COLUMN IF EXISTS is_low_rated;

ALTER TABLE customer_reviews
  ADD COLUMN is_low_rated BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN star_rating IS NOT NULL THEN star_rating <= 2
      ELSE NULL
    END
  ) STORED;

ALTER TABLE customer_reviews
  DROP COLUMN IF EXISTS expires_at;

ALTER TABLE customer_reviews
  ADD COLUMN expires_at TIMESTAMPTZ GENERATED ALWAYS AS
    (link_generated_at + INTERVAL '48 hours') STORED;

ALTER TABLE customer_reviews
  ALTER COLUMN star_rating DROP NOT NULL;

-- Indexes for org-scoped queries and analytics
CREATE INDEX IF NOT EXISTS idx_customer_reviews_org_submitted
  ON customer_reviews (organization_id, submitted_at DESC)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_reviews_low_rated
  ON customer_reviews (organization_id)
  WHERE is_low_rated = TRUE;

CREATE INDEX IF NOT EXISTS idx_customer_reviews_job_id
  ON customer_reviews (job_id);

-- Constraint: customer_reviews row can only be created within 48 hours of job completion
-- (enforced by application layer, not DB trigger)

-- Update job_timeline trigger to include review_submitted events
-- (This is a reminder; job_timeline already exists and handles arbitrary event_type values)
