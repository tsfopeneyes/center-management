-- Add guest_properties JSONB column to public.notices table
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS guest_properties JSONB DEFAULT '{"allow_guest": true, "require_school": true, "require_phone": true}'::jsonb;
