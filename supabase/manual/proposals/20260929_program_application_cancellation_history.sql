-- DRAFT ONLY. Coordinate with the verified application transition and client.
-- This widens the status domain without changing existing rows. Cancelled
-- applications remain in notice_responses; a private immutable copy is made
-- before a later reapplication replaces that row's answers and snapshot.
BEGIN;

ALTER TABLE public.notice_responses
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.notice_responses
    DROP CONSTRAINT notice_responses_status_check;
ALTER TABLE public.notice_responses
    ADD CONSTRAINT notice_responses_status_check
    CHECK (status IN ('JOIN', 'DECLINE', 'WAITLIST', 'UNDECIDED', 'CANCELLED'));
ALTER TABLE public.notice_responses
    ADD CONSTRAINT notice_responses_cancelled_at_check
    CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL));

CREATE TABLE public.program_application_attempt_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    response_id bigint NOT NULL,
    notice_id bigint NOT NULL,
    user_id uuid NOT NULL,
    status text NOT NULL CHECK (status = 'CANCELLED'),
    is_attended boolean,
    applied_at timestamptz NOT NULL,
    cancelled_at timestamptz NOT NULL,
    application_answers jsonb NOT NULL,
    application_form_revision integer,
    application_form_snapshot jsonb,
    archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX program_application_attempt_history_lookup
    ON public.program_application_attempt_history (notice_id, user_id, archived_at);
ALTER TABLE public.program_application_attempt_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.program_application_attempt_history FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.archive_cancelled_program_application_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
    IF OLD.status = 'CANCELLED' AND NEW.status IN ('JOIN', 'WAITLIST') THEN
        INSERT INTO public.program_application_attempt_history (
            response_id, notice_id, user_id, status, is_attended, applied_at,
            cancelled_at, application_answers, application_form_revision,
            application_form_snapshot
        ) VALUES (
            OLD.id, OLD.notice_id, OLD.user_id, OLD.status, OLD.is_attended,
            OLD.created_at, OLD.cancelled_at, OLD.application_answers,
            OLD.application_form_revision, OLD.application_form_snapshot
        );
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_cancelled_program_application_attempt() FROM PUBLIC;
CREATE TRIGGER archive_cancelled_program_application_attempt
    BEFORE UPDATE OF status ON public.notice_responses
    FOR EACH ROW EXECUTE FUNCTION public.archive_cancelled_program_application_attempt();

-- Preserve the existing DELETE notification for legacy/challenge clients;
-- also notify when the new transition preserves a cancelled row by UPDATE.
CREATE OR REPLACE FUNCTION public.create_application_state_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    program_title text;
    notification_content text;
    response_user_id uuid;
    response_notice_id bigint;
    response_status text;
    is_cancellation boolean := false;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
        response_user_id := OLD.user_id;
        response_notice_id := OLD.notice_id;
        response_status := OLD.status;
        IF response_status NOT IN ('JOIN', 'WAITLIST') THEN RETURN OLD; END IF;
        is_cancellation := true;
    ELSE
        response_user_id := NEW.user_id;
        response_notice_id := NEW.notice_id;
        response_status := NEW.status;
        IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
        is_cancellation := TG_OP = 'UPDATE'
            AND OLD.status IN ('JOIN', 'WAITLIST') AND response_status = 'CANCELLED';
        IF NOT is_cancellation AND response_status NOT IN ('JOIN', 'WAITLIST') THEN RETURN NEW; END IF;
    END IF;

    SELECT title INTO program_title FROM public.notices WHERE id = response_notice_id;
    IF program_title IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;
    notification_content := CASE
        WHEN is_cancellation THEN '📭 [' || program_title || '] 프로그램 신청이 취소되었습니다.'
        WHEN response_status = 'WAITLIST' THEN '⏳ [' || program_title || '] 프로그램 대기 신청이 완료되었습니다!'
        ELSE '🎉 [' || program_title || '] 프로그램 신청이 완료되었습니다!'
    END;
    INSERT INTO public.app_notifications (
        sender_id, target_group, content, notice_id, notification_type
    ) VALUES (
        response_user_id, 'USER_' || response_user_id::text,
        notification_content, response_notice_id, 'APPLICATION'
    );
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

COMMIT;
