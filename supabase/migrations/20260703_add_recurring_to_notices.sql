-- Add recurring columns to notices table
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS recurring_days INTEGER[] DEFAULT '{}';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS recurring_end_date DATE;

-- Force refreshing schema cache
NOTIFY pgrst, 'reload schema';
