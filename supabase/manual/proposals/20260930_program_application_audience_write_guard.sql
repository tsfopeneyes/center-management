-- Only trusted server-side application transitions may set or change the
-- application-time audience. Ordinary anon/authenticated table writes may
-- still update attendance or other permitted fields without touching it.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_program_application_audience_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' AND NEW.application_audience IS NOT NULL THEN
            RAISE EXCEPTION '신청 당시 대상은 직접 변경할 수 없습니다.' USING ERRCODE = '42501';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.application_audience IS DISTINCT FROM OLD.application_audience THEN
            RAISE EXCEPTION '신청 당시 대상은 직접 변경할 수 없습니다.' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_program_application_audience_write() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_notice_application_audience_write ON public.notice_responses;
CREATE TRIGGER guard_notice_application_audience_write
    BEFORE INSERT OR UPDATE OF application_audience ON public.notice_responses
    FOR EACH ROW EXECUTE FUNCTION public.guard_program_application_audience_write();
DROP TRIGGER IF EXISTS guard_session_application_audience_write ON public.daily_program_session_responses;
CREATE TRIGGER guard_session_application_audience_write
    BEFORE INSERT OR UPDATE OF application_audience ON public.daily_program_session_responses
    FOR EACH ROW EXECUTE FUNCTION public.guard_program_application_audience_write();
COMMIT;
