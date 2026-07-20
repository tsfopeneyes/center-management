-- Add is_private column to notices table
ALTER TABLE notices ADD COLUMN is_private BOOLEAN DEFAULT FALSE;
