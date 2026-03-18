-- Add preferences column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- (Optional) If you want to see if there are any existing preferences:
-- SELECT id, name, preferences FROM public.users where role = 'admin';
