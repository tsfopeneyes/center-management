-- Reviewed expand proposal for existing program application responses.
-- Apply after the two cancelled-attempt history tables exist and before the
-- updated application transitions. No historical audience is backfilled:
-- today's account group does not prove the group at an earlier application.
-- Impact: four nullable columns, four CHECK constraints, two archive-function
-- replacements. No existing row or raw log is deleted or rewritten.
BEGIN;

DO $$
DECLARE
    v_table text;
    v_constraint text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'notice_responses', 'daily_program_session_responses',
        'program_application_attempt_history', 'program_session_application_attempt_history'
    ] LOOP
        -- Older isolated fixtures may exercise only one application scope.
        -- The production preflight separately requires all four relations.
        IF to_regclass(format('public.%I', v_table)) IS NULL THEN CONTINUE; END IF;
        v_constraint := v_table || '_audience_check';
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS application_audience text', v_table);
        IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
            WHERE conrelid = to_regclass(format('public.%I', v_table)) AND conname = v_constraint) THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (application_audience IS NULL OR application_audience IN (''MEMBER'', ''GUEST''))',
                v_table, v_constraint);
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_cancelled_program_application_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
    IF OLD.status = 'CANCELLED' AND NEW.status IN ('JOIN', 'WAITLIST') THEN
        INSERT INTO public.program_application_attempt_history (
            response_id, notice_id, user_id, status, is_attended, applied_at,
            cancelled_at, application_answers, application_form_revision,
            application_form_snapshot, application_audience
        ) VALUES (
            OLD.id, OLD.notice_id, OLD.user_id, OLD.status, OLD.is_attended,
            OLD.created_at, OLD.cancelled_at, OLD.application_answers,
            OLD.application_form_revision, OLD.application_form_snapshot,
            OLD.application_audience
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_cancelled_program_session_application_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
    IF OLD.status = 'CANCELLED' AND NEW.status IN ('JOIN', 'WAITLIST') THEN
        INSERT INTO public.program_session_application_attempt_history (
            session_id, user_id, status, is_attended, applied_at, cancelled_at,
            application_answers, application_form_revision, application_form_snapshot,
            application_audience
        ) VALUES (
            OLD.session_id, OLD.user_id, OLD.status, OLD.is_attended,
            OLD.created_at, OLD.cancelled_at, OLD.application_answers,
            OLD.application_form_revision, OLD.application_form_snapshot,
            OLD.application_audience
        );
    END IF;
    RETURN NEW;
END;
$$;

COMMIT;
