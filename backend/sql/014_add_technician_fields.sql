-- Add phone and region fields to users table for technician profiles
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT;
