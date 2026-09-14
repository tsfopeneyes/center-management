ALTER TABLE public.daily_program_sessions
    ADD COLUMN IF NOT EXISTS session_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.daily_program_sessions
    DROP CONSTRAINT IF EXISTS daily_program_sessions_session_fields_array;

ALTER TABLE public.daily_program_sessions
    ADD CONSTRAINT daily_program_sessions_session_fields_array
    CHECK (jsonb_typeof(session_fields) = 'array');

COMMENT ON COLUMN public.daily_program_sessions.session_fields IS
    'Snapshot of the program-defined field labels and values for this daily session.';
