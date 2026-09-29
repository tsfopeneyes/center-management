-- CUTOVER DRAFT ONLY. Apply after the new client uses the verified RPC/view
-- endpoints. Old tabs that write notice_responses directly must reload.
-- Does not remove existing applications, challenge writes, staff attendance
-- edits, or account-merge worker access. Review live policies before use.
BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.respond_to_program_application(bigint,uuid,text,jsonb)') IS NULL
        OR to_regprocedure('public.apply_guest_program_application(bigint,uuid,text,text,text,jsonb)') IS NULL
        OR to_regprocedure('public.is_current_staff()') IS NULL
        OR NOT EXISTS (
            SELECT 1 FROM pg_class cls JOIN pg_namespace ns ON ns.oid = cls.relnamespace
            WHERE ns.nspname = 'public' AND cls.relname = 'notice_responses'
                AND cls.relrowsecurity
        ) THEN
        RAISE EXCEPTION 'Application endpoints, staff guard, or response RLS are missing';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notice_response_legacy_write_allowed(p_notice_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.notices n WHERE n.id = p_notice_id
            AND (n.category IS DISTINCT FROM 'PROGRAM' OR n.is_challenge IS TRUE)
    )
$$;
REVOKE ALL ON FUNCTION public.notice_response_legacy_write_allowed(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notice_response_legacy_write_allowed(bigint)
    TO anon, authenticated;

-- Restrictive policies intersect the existing permissive policies. They
-- prevent direct member/guest writes for ordinary programs without modifying
-- SELECT, challenge applications, administrator operations, or merge workers.
CREATE POLICY program_application_verified_insert
    ON public.notice_responses AS RESTRICTIVE FOR INSERT TO anon, authenticated
    WITH CHECK (
        public.is_current_staff()
        OR public.notice_response_legacy_write_allowed(notice_id)
    );
CREATE POLICY program_application_verified_update
    ON public.notice_responses AS RESTRICTIVE FOR UPDATE TO anon, authenticated
    USING (
        public.is_current_staff()
        OR public.notice_response_legacy_write_allowed(notice_id)
    )
    WITH CHECK (
        public.is_current_staff()
        OR public.notice_response_legacy_write_allowed(notice_id)
    );
CREATE POLICY program_application_verified_delete
    ON public.notice_responses AS RESTRICTIVE FOR DELETE TO anon, authenticated
    USING (
        public.is_current_staff()
        OR public.notice_response_legacy_write_allowed(notice_id)
    );

NOTIFY pgrst, 'reload schema';
COMMIT;
