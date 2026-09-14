ALTER TABLE public.daily_program_sessions
    RENAME COLUMN menu TO session_summary;

ALTER TABLE public.daily_program_sessions
    RENAME COLUMN conversation_question TO session_prompt;

ALTER TABLE public.daily_program_sessions
    ALTER COLUMN session_prompt DROP NOT NULL;

COMMENT ON COLUMN public.daily_program_sessions.session_summary IS 'Program-defined primary information for this daily session.';
COMMENT ON COLUMN public.daily_program_sessions.session_prompt IS 'Optional program-defined secondary information for this daily session.';
