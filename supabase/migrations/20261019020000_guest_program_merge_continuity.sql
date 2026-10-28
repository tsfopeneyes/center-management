-- No existing profile/application/log row is modified by this migration.
-- Only the server's NOLOGIN merge role can inspect references or move reviewed
-- program records. Unreviewed records still cause an atomic rollback.
BEGIN;
CREATE TABLE account_security.account_merge_program_originals (
    request_id uuid NOT NULL,
    source_profile_id uuid NOT NULL,
    target_profile_id uuid NOT NULL,
    table_name text NOT NULL,
    original_profile_id uuid NOT NULL,
    row_key text NOT NULL,
    row_data jsonb NOT NULL,
    archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(request_id,table_name,original_profile_id,row_key)
);
ALTER TABLE account_security.account_merge_program_originals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.account_merge_program_originals FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON account_security.account_merge_program_originals TO account_merge_worker;
CREATE POLICY account_merge_program_originals ON account_security.account_merge_program_originals
    TO account_merge_worker USING (
        source_profile_id=NULLIF(current_setting('app.merge_source_id',true),'')::uuid
        AND target_profile_id=NULLIF(current_setting('app.merge_target_id',true),'')::uuid
    ) WITH CHECK (
        source_profile_id=NULLIF(current_setting('app.merge_source_id',true),'')::uuid
        AND target_profile_id=NULLIF(current_setting('app.merge_target_id',true),'')::uuid
    );

DO $reviewed$
DECLARE item record;
BEGIN
    FOR item IN SELECT * FROM (VALUES
        ('notice_responses','user_id'),('daily_program_session_responses','user_id'),
        ('open_program_attendance','user_id'),('program_attendance','user_id'),
        ('program_application_attempt_history','user_id'),('program_session_application_attempt_history','user_id'),
        ('offline_challenge_submissions','participant_id'),('online_challenge_submissions','participant_id'),
        ('challenge_completion_rewards','participant_id'),('program_close_reward_grants','user_id')
    ) AS relations(table_name,column_name) LOOP
        IF to_regclass('public.'||item.table_name) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('GRANT SELECT,UPDATE(%I) ON public.%I TO account_merge_worker',item.column_name,item.table_name);
        -- Combining duplicate applications also needs the reviewed response
        -- fields; complete originals are archived before either is changed.
        IF item.table_name IN ('notice_responses','daily_program_session_responses','open_program_attendance') THEN
            EXECUTE format('GRANT UPDATE,DELETE ON public.%I TO account_merge_worker',item.table_name);
        END IF;
        EXECUTE format('CREATE POLICY guest_program_merge_transfer ON public.%I TO account_merge_worker USING
            (%I IN (NULLIF(current_setting(''app.merge_source_id'',true),'''')::uuid,
                    NULLIF(current_setting(''app.merge_target_id'',true),'''')::uuid)) WITH CHECK
            (%I IN (NULLIF(current_setting(''app.merge_source_id'',true),'''')::uuid,
                    NULLIF(current_setting(''app.merge_target_id'',true),'''')::uuid))',
            item.table_name,item.column_name,item.column_name);
    END LOOP;
END $reviewed$;

-- New/unreviewed FK tables expose only an existence bit for the validated guest.
-- No SELECT permission on message bodies, no dynamic record transfer/deletion.
CREATE FUNCTION account_security.merge_reference_has_rows(p_table text,p_column text,p_source uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE affected boolean;
BEGIN
    IF current_setting('role',true)<>'account_merge_worker'
        OR p_source IS DISTINCT FROM NULLIF(current_setting('app.merge_source_id',true),'')::uuid
        OR p_source IS NULL THEN RAISE EXCEPTION 'Invalid merge reference audit' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=fk.conkey[1]
        WHERE fk.contype='f' AND fk.confrelid='public.users'::regclass AND n.nspname='public'
        AND cardinality(fk.conkey)=1 AND cardinality(fk.confkey)=1
        AND c.relname=p_table AND a.attname=p_column) THEN
        RAISE EXCEPTION 'Unrecognized merge reference' USING ERRCODE='42501';
    END IF;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1)',p_table,p_column) INTO affected USING p_source;
    RETURN affected;
END $$;
REVOKE ALL ON FUNCTION account_security.merge_reference_has_rows(text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION account_security.merge_reference_has_rows(text,text,uuid) TO account_merge_worker;

-- Combining duplicate registrations is identity maintenance, not a new
-- registration/cancellation. Do not send false cancellation notifications or
-- reject an identity merge just because recruitment already closed.
DO $guards$
DECLARE function_name text; definition text; guard text;
BEGIN
    guard:=E'\nBEGIN\n    IF current_setting(''role'',true)=''account_merge_worker''\n'
        ||E'        AND NULLIF(current_setting(''app.merge_source_id'',true),'''') IS NOT NULL\n'
        ||E'        AND NULLIF(current_setting(''app.merge_target_id'',true),'''') IS NOT NULL THEN\n'
        ||E'        IF TG_OP=''DELETE'' THEN RETURN OLD; ELSE RETURN NEW; END IF;\n    END IF;\n';
    FOREACH function_name IN ARRAY ARRAY['create_application_state_notification','guard_program_recruitment_response'] LOOP
        IF to_regprocedure('public.'||function_name||'()') IS NULL THEN CONTINUE; END IF;
        SELECT pg_get_functiondef(to_regprocedure('public.'||function_name||'()')) INTO definition;
        IF strpos(definition,E'\nBEGIN\n')=0 THEN RAISE EXCEPTION 'Unrecognized trigger definition: %',function_name; END IF;
        EXECUTE replace(definition,E'\nBEGIN\n',guard);
    END LOOP;
END $guards$;
COMMIT;
