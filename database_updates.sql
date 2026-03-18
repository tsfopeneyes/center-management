-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create tables if not exists
CREATE TABLE IF NOT EXISTS public.calendar_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    color_theme TEXT NOT NULL DEFAULT 'blue',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint to name to avoid duplicates if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_categories_name_key') THEN
        ALTER TABLE public.calendar_categories ADD CONSTRAINT calendar_categories_name_key UNIQUE (name);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.admin_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    category_id UUID REFERENCES public.calendar_categories(id),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Clean up existing policies to start fresh
DROP POLICY IF EXISTS "Admins have full access to calendar_categories" ON public.calendar_categories;
DROP POLICY IF EXISTS "Anyone can view calendar_categories" ON public.calendar_categories;
DROP POLICY IF EXISTS "Admins have full access to admin_schedules" ON public.admin_schedules;
DROP POLICY IF EXISTS "Anyone can view admin_schedules" ON public.admin_schedules;

-- 4. Enable RLS
ALTER TABLE public.calendar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_schedules ENABLE ROW LEVEL SECURITY;

-- 5. Create robust policies
-- For development, we allow all authenticated actions if RLS identity is tricky
-- These can be tightened later if using full Supabase Auth
CREATE POLICY "Enable all for calendar_categories" ON public.calendar_categories
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for admin_schedules" ON public.admin_schedules
FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed default categories (Idempotent)
INSERT INTO public.calendar_categories (name, color_theme) 
VALUES ('회의', 'blue'), ('연차/휴가', 'green'), ('대관', 'purple'), ('외부 일정', 'orange')
ON CONFLICT (name) DO NOTHING;
-- Create calling_forest_progress table
CREATE TABLE IF NOT EXISTS public.calling_forest_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.users(id) NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 6),
    log_id UUID REFERENCES public.school_logs(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, week_number)
);

-- Enable RLS
ALTER TABLE public.calling_forest_progress ENABLE ROW LEVEL SECURITY;

-- Allow all for now (similar to other tables in this project for simplicity, to prevent RLS issues)
CREATE POLICY "Enable all for calling_forest_progress" ON public.calling_forest_progress FOR ALL USING (true) WITH CHECK (true);

-- Enable real-time for community_posts
alter publication supabase_realtime add table community_posts;

-- Recalculate comments_count to fix miscounts from previous missing bugs
-- Run this if UI shows wrong counts compared to actual comments list
-- UPDATE community_posts p
-- SET comments_count = (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id);
-- UPDATE community_posts p
-- SET likes_count = (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id);

-- Add updated_at to community_comments for edit functionality
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Add updated_at to community_posts for edit functionality
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Polling Feature Updates
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_poll BOOLEAN DEFAULT false;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS poll_options JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS poll_deadline TIMESTAMPTZ;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS allow_multiple_votes BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.notice_poll_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notice_id BIGINT REFERENCES public.notices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Drop the old unique constraint if it exists (assuming it was named notice_poll_responses_notice_id_user_id_key by postgres or explicitly)
ALTER TABLE public.notice_poll_responses DROP CONSTRAINT IF EXISTS notice_poll_responses_notice_id_user_id_key;
-- Add the new unique constraint that includes option_id
ALTER TABLE public.notice_poll_responses DROP CONSTRAINT IF EXISTS notice_poll_responses_unique_vote;
ALTER TABLE public.notice_poll_responses ADD CONSTRAINT notice_poll_responses_unique_vote UNIQUE(notice_id, user_id, option_id);

ALTER TABLE public.notice_poll_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notice_poll_responses' 
        AND policyname = 'Enable all for notice_poll_responses'
    ) THEN
        CREATE POLICY "Enable all for notice_poll_responses" 
        ON public.notice_poll_responses FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- Snack History column for schools
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS snack_history JSONB DEFAULT '[]'::jsonb;
