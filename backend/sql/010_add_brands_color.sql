-- Add color_hex column to brands table for UI brand customization
ALTER TABLE brands ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);

-- Create index for faster lookups on organization_id (required for tenant isolation)
CREATE INDEX IF NOT EXISTS idx_brands_org
  ON brands (organization_id)
  WHERE is_deleted = FALSE;
