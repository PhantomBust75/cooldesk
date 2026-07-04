-- Add installation_charge column to brands table for technician payment flow
ALTER TABLE brands ADD COLUMN IF NOT EXISTS installation_charge NUMERIC(10, 2) NOT NULL DEFAULT 0;
