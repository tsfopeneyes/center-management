-- Preserve accepted applicants when a one-time application program is converted
-- to recurring, per-session applications. The original applicants belong to the
-- first scheduled occurrence; later occurrences start empty.

CREATE OR REPLACE FUNCTION public.carry_legacy_program_applicants_to_first_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    program public.notices%ROWTYPE;
    first_session_date date;
BEGIN
    SELECT * INTO program FROM public.notices WHERE id = NEW.notice_id;
    IF NOT FOUND
        OR coalesce(program.guest_properties->>'schedule_mode', '') <> 'RECURRING'
        OR coalesce(program.guest_properties->>'application_scope', '') <> 'SESSION' THEN
        RETURN NEW;
    END IF;

    first_session_date := coalesce(
        program.program_start_date,
        (program.program_date AT TIME ZONE 'Asia/Seoul')::date
    );
    IF first_session_date IS NULL OR NEW.session_date <> first_session_date THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.daily_program_session_responses (
        session_id, user_id, status, is_attended, application_answers, created_at, cancelled_at
    )
    SELECT
        NEW.id,
        response.user_id,
        CASE WHEN response.status = 'WAITLIST' THEN 'WAITLIST' ELSE 'JOIN' END,
        coalesce(response.is_attended, false),
        coalesce(response.application_answers, '{}'::jsonb),
        response.created_at,
        NULL
    FROM public.notice_responses response
    WHERE response.notice_id = NEW.notice_id
      AND response.status IN ('JOIN', 'WAITLIST')
    ON CONFLICT (session_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carry_legacy_program_applicants ON public.daily_program_sessions;
CREATE TRIGGER trg_carry_legacy_program_applicants
AFTER INSERT ON public.daily_program_sessions
FOR EACH ROW
EXECUTE FUNCTION public.carry_legacy_program_applicants_to_first_session();

-- Safe backfill for a first session that may already have been opened.
INSERT INTO public.daily_program_session_responses (
    session_id, user_id, status, is_attended, application_answers, created_at, cancelled_at
)
SELECT
    session.id,
    response.user_id,
    CASE WHEN response.status = 'WAITLIST' THEN 'WAITLIST' ELSE 'JOIN' END,
    coalesce(response.is_attended, false),
    coalesce(response.application_answers, '{}'::jsonb),
    response.created_at,
    NULL
FROM public.daily_program_sessions session
JOIN public.notices program ON program.id = session.notice_id
JOIN public.notice_responses response ON response.notice_id = program.id
WHERE session.voided_at IS NULL
  AND coalesce(program.guest_properties->>'schedule_mode', '') = 'RECURRING'
  AND coalesce(program.guest_properties->>'application_scope', '') = 'SESSION'
  AND session.session_date = coalesce(
      program.program_start_date,
      (program.program_date AT TIME ZONE 'Asia/Seoul')::date
  )
  AND response.status IN ('JOIN', 'WAITLIST')
ON CONFLICT (session_id, user_id) DO NOTHING;

REVOKE ALL ON FUNCTION public.carry_legacy_program_applicants_to_first_session() FROM PUBLIC;
