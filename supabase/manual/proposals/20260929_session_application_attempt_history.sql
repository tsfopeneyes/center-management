-- DRAFT ONLY. Apply before enabling member/guest session questions. The
-- current session response remains the operational row; the cancelled attempt
-- is privately archived before a later reapplication replaces its answers.
BEGIN;

CREATE TABLE public.program_session_application_attempt_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text NOT NULL CHECK (status = 'CANCELLED'),
    is_attended boolean NOT NULL,
    applied_at timestamptz NOT NULL,
    cancelled_at timestamptz NOT NULL,
    application_answers jsonb NOT NULL,
    application_form_revision integer,
    application_form_snapshot jsonb,
    archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX program_session_application_attempt_history_lookup
    ON public.program_session_application_attempt_history (session_id, user_id, archived_at);
ALTER TABLE public.program_session_application_attempt_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.program_session_application_attempt_history FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.archive_cancelled_program_session_application_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
    IF OLD.status = 'CANCELLED' AND NEW.status IN ('JOIN', 'WAITLIST') THEN
        INSERT INTO public.program_session_application_attempt_history (
            session_id, user_id, status, is_attended, applied_at, cancelled_at,
            application_answers, application_form_revision, application_form_snapshot
        ) VALUES (
            OLD.session_id, OLD.user_id, OLD.status, OLD.is_attended,
            OLD.created_at, OLD.cancelled_at, OLD.application_answers,
            OLD.application_form_revision, OLD.application_form_snapshot
        );
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_cancelled_program_session_application_attempt() FROM PUBLIC;
CREATE TRIGGER archive_cancelled_program_session_application_attempt
    BEFORE UPDATE OF status ON public.daily_program_session_responses
    FOR EACH ROW EXECUTE FUNCTION public.archive_cancelled_program_session_application_attempt();

COMMIT;
