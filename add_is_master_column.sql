-- 1. Add is_master column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'is_master') THEN
        ALTER TABLE public.users ADD COLUMN is_master BOOLEAN DEFAULT false;
    END IF;
END
$$;

-- 2. Set 'Rok' account as the initial master
-- Replace with the actual name or ID if needed, but based on your request, name is 'Rok'
UPDATE public.users SET is_master = true WHERE name = 'Rok';

-- 3. (Optional) Set 'admin' as master if it exists
UPDATE public.users SET is_master = true WHERE name = 'admin';
