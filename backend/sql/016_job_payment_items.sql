-- Line-item breakdown for payments: links a payment to the service items used
CREATE TABLE IF NOT EXISTS job_payment_items (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  payment_id       UUID         NOT NULL REFERENCES payments(id)     ON DELETE CASCADE,
  job_id           UUID         NOT NULL REFERENCES jobs(id)         ON DELETE RESTRICT,
  service_item_id  UUID         REFERENCES service_items(id)         ON DELETE SET NULL,
  name             TEXT         NOT NULL,
  unit_price       NUMERIC(12,2) NOT NULL,
  quantity         NUMERIC(10,3) NOT NULL DEFAULT 1,
  total            NUMERIC(12,2) NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_payment_items_payment ON job_payment_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_job_payment_items_job     ON job_payment_items(job_id);
