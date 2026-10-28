-- PostgreSQL may plan every applicable RLS predicate even when a separate
-- merge policy permits the row. The NOLOGIN merge worker therefore needs the
-- same permission-check functions referenced by those existing PUBLIC policies.
-- This changes no table policy, client role, profile, application or raw log.
BEGIN;
GRANT EXECUTE ON FUNCTION public.calendar_is_admin() TO account_merge_worker;
GRANT EXECUTE ON FUNCTION public.is_current_profile(uuid) TO account_merge_worker;
GRANT EXECUTE ON FUNCTION public.is_challenge_host(bigint) TO account_merge_worker;
-- Relinking an unchanged historical certification is not a new submission.
-- Do not require access to its mission definition or reopen closed/inactive
-- missions. Only the server merge role and its exact source/target may do this.
DO $offline_identity$
DECLARE definition text; guard text;
BEGIN
    IF to_regprocedure('public.prepare_offline_challenge_submission()') IS NULL THEN RETURN; END IF;
    SELECT pg_get_functiondef('public.prepare_offline_challenge_submission()'::regprocedure) INTO definition;
    IF strpos(definition,E'\nBEGIN\n')=0 THEN RAISE EXCEPTION 'Unrecognized offline certification trigger'; END IF;
    guard:=E'\nBEGIN\n    IF TG_OP=''UPDATE'' AND current_setting(''role'',true)=''account_merge_worker''\n'
        ||E'        AND OLD.participant_id=NULLIF(current_setting(''app.merge_source_id'',true),'''')::uuid\n'
        ||E'        AND NEW.participant_id=NULLIF(current_setting(''app.merge_target_id'',true),'''')::uuid\n'
        ||E'        AND (to_jsonb(NEW)-''participant_id'') IS NOT DISTINCT FROM (to_jsonb(OLD)-''participant_id'')\n'
        ||E'    THEN RETURN NEW; END IF;\n';
    EXECUTE replace(definition,E'\nBEGIN\n',guard);
END $offline_identity$;
COMMIT;
