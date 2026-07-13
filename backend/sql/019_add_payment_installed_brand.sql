-- Records which brand was installed at payment time and its installation charge.
-- Lets the payment breakdown show the brand fee as a first-class line (not a
-- derived "additional charge") and keeps the installed brand queryable per payment.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS installed_brand_id  UUID          REFERENCES brands(id),
  ADD COLUMN IF NOT EXISTS installation_charge NUMERIC(12,2);
