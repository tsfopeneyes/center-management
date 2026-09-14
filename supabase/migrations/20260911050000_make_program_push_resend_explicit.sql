BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A completed program push may only be queued again through an explicit,
-- one-time resend nonce. Ordinary notice edits must never reset delivery.
CREATE OR REPLACE FUNCTION public.sync_program_push_job() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
    plan jsonb;
    plan_key_value text;
    timing_value text;
    audience_value text;
    due_at timestamptz;
    resend_requested boolean := false;
BEGIN
    IF TG_OP='UPDATE' THEN
        resend_requested := coalesce(NEW.guest_properties->>'recruitment_push_resend_nonce','')
            IS DISTINCT FROM coalesce(OLD.guest_properties->>'recruitment_push_resend_nonce','');
    END IF;

    IF TG_OP='UPDATE' AND NEW.guest_properties IS NOT DISTINCT FROM OLD.guest_properties
        AND NEW.recruitment_start_at IS NOT DISTINCT FROM OLD.recruitment_start_at
        AND NEW.program_date IS NOT DISTINCT FROM OLD.program_date
        AND NEW.program_start_date IS NOT DISTINCT FROM OLD.program_start_date
        AND NEW.is_private IS NOT DISTINCT FROM OLD.is_private
        AND NEW.program_status IS NOT DISTINCT FROM OLD.program_status THEN
        RETURN NEW;
    END IF;

    IF NEW.category<>'PROGRAM' OR coalesce((NEW.guest_properties->>'recruitment_push_enabled')::boolean,false)=false
        OR coalesce(NEW.is_private,false) OR coalesce(NEW.program_status,'ACTIVE') IN ('CANCELLED','COMPLETED') THEN
        UPDATE public.program_push_jobs SET state='CANCELLED',updated_at=statement_timestamp()
        WHERE notice_id=NEW.id AND state NOT IN ('SENT','PARTIAL');
        RETURN NEW;
    END IF;

    UPDATE public.program_push_jobs SET state='CANCELLED',updated_at=statement_timestamp()
    WHERE notice_id=NEW.id AND state NOT IN ('SENT','PARTIAL')
      AND plan_key NOT IN (SELECT coalesce(value->>'id',value->>'timing') FROM jsonb_array_elements(coalesce(NEW.guest_properties->'recruitment_push_plans','[]'::jsonb)));

    FOR plan IN SELECT value FROM jsonb_array_elements(coalesce(NEW.guest_properties->'recruitment_push_plans','[]'::jsonb)) LOOP
        timing_value := plan->>'timing';
        plan_key_value := coalesce(nullif(plan->>'id',''),timing_value);
        audience_value := coalesce(plan->>'audience','TARGET_REGIONS');
        IF timing_value IN ('BEFORE_PROGRAM_1D','BEFORE_PROGRAM_1H') THEN audience_value := 'APPLICANTS'; END IF;
        IF audience_value NOT IN ('TARGET_REGIONS','ALL','APPLICANTS') THEN audience_value := 'TARGET_REGIONS'; END IF;
        due_at := CASE timing_value
            WHEN 'AT_START' THEN NEW.recruitment_start_at
            WHEN 'BEFORE_PROGRAM_1D' THEN coalesce(NEW.program_date, NEW.program_start_date::timestamp AT TIME ZONE 'Asia/Seoul') - interval '1 day'
            WHEN 'BEFORE_PROGRAM_1H' THEN coalesce(NEW.program_date, NEW.program_start_date::timestamp AT TIME ZONE 'Asia/Seoul') - interval '1 hour'
            WHEN 'NOW' THEN statement_timestamp()
            WHEN 'CUSTOM' THEN CASE WHEN coalesce(plan->>'scheduled_at','') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' THEN (plan->>'scheduled_at')::timestamptz END
            ELSE NULL END;
        IF due_at IS NULL THEN CONTINUE; END IF;

        INSERT INTO public.program_push_jobs(notice_id,plan_key,timing,audience,scheduled_at)
        VALUES(NEW.id,plan_key_value,timing_value,audience_value,due_at)
        ON CONFLICT(notice_id,plan_key) DO UPDATE SET
            timing=EXCLUDED.timing,
            audience=EXCLUDED.audience,
            scheduled_at=EXCLUDED.scheduled_at,
            state='PENDING',
            target_count=0,
            success_count=0,
            failure_count=0,
            sent_at=NULL,
            last_error_code=NULL,
            updated_at=statement_timestamp()
        WHERE program_push_jobs.state NOT IN ('SENT','PARTIAL','SENDING','UNCERTAIN') OR resend_requested;
    END LOOP;
    RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sync_program_push_job() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
