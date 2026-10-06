-- Single server-side classification rule for new program application attempts.
-- Existing responses are not backfilled or rewritten.
BEGIN;
CREATE OR REPLACE FUNCTION public.program_application_audience_for_user(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
    SELECT CASE
        WHEN u.user_group IN ('게스트', '미가입')
            OR u.preferences->>'is_temporary' = 'true' THEN 'GUEST'
        WHEN u.user_group IS NOT NULL THEN 'MEMBER'
        ELSE NULL
    END
    FROM public.users u WHERE u.id = p_user_id
$$;
REVOKE ALL ON FUNCTION public.program_application_audience_for_user(uuid) FROM PUBLIC;
COMMIT;
