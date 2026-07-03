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
