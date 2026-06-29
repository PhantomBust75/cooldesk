-- Add missing fields to dealers for the new UI redesign
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS region TEXT;
