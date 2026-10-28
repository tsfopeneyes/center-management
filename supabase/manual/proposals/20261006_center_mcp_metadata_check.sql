-- Read-only structural impact check; no user/session/client rows selected.
SELECT jsonb_build_object(
 'auth_columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type) ORDER BY table_name,ordinal_position)
 FROM information_schema.columns WHERE table_schema='auth' AND (table_name LIKE 'oauth%' OR table_name='sessions')),
 'public_id_types',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type) ORDER BY table_name,column_name)
 FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('id','notice_id','user_id') AND table_name IN
 ('users','staff_directory','locations','logs','notices','notice_responses','daily_program_sessions','daily_program_session_responses','open_program_attendance')),
 'existing_hooks',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'security_definer',p.prosecdef,'arguments',pg_get_function_identity_arguments(p.oid)))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('account_security','public') AND p.proname ILIKE '%hook%'),
 'reader_role_exists', EXISTS(SELECT 1 FROM pg_roles WHERE rolname='center_statistics_reader')) AS impact;
