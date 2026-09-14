ALTER TABLE public.daily_program_sessions
    ADD COLUMN IF NOT EXISTS voided_at timestamptz;

COMMENT ON COLUMN public.daily_program_sessions.voided_at IS
    'Set when a closed session has no response history. Voided sessions are excluded from calendars, rosters, and operating statistics.';

UPDATE public.daily_program_sessions AS session
SET voided_at = COALESCE(session.voided_at, session.updated_at, now())
WHERE session.status = 'CLOSED'
  AND session.voided_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.daily_program_session_responses AS response
      WHERE response.session_id = session.id
  );

CREATE INDEX IF NOT EXISTS daily_program_sessions_countable_idx
    ON public.daily_program_sessions (notice_id, session_date)
    WHERE voided_at IS NULL;

