-- Add is_active column to locations table to allow hiding locations without deleting them
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure all existing locations are set to true (in case the default doesn't apply to existing rows in some Postgres versions)
UPDATE public.locations SET is_active = true WHERE is_active IS NULL;
