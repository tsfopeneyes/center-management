-- Add status and guardian information columns to the users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS guardian_name TEXT,
ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
ADD COLUMN IF NOT EXISTS guardian_relation TEXT;

-- Update existing users to have 'approved' status if they don't have one
UPDATE public.users SET status = 'approved' WHERE status IS NULL;
