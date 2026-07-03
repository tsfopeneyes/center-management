-- Add is_leader_only column to notices table
ALTER TABLE notices ADD COLUMN IF NOT EXISTS is_leader_only BOOLEAN DEFAULT false;

-- Force refreshing schema cache
NOTIFY pgrst, 'reload schema';
