-- Metadata only. No account, student, session, consent, token or config rows.
SELECT jsonb_build_object(
 'target_tables', (SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
   'restrictive_policy_count',(SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND NOT p.polpermissive)))
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='public' AND c.relname IN ('users','staff_directory','locations','logs','notices','notice_responses','daily_program_sessions','daily_program_session_responses','open_program_attendance'))
    OR (n.nspname='account_security' AND c.relname IN ('accounts','account_roles','session_assurances'))
    OR (n.nspname='auth' AND c.relname IN ('sessions','oauth_clients','oauth_consents','oauth_authorizations'))),
 'roles',(SELECT jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'login',rolcanlogin))
  FROM pg_roles WHERE rolname IN ('authenticator','center_statistics_reader','center_mcp_consent_writer','center_mcp_release_worker','center_mcp_oauth')),
 'jwt_role_can_be_assumed',CASE WHEN to_regrole('center_mcp_oauth') IS NULL THEN false
  ELSE pg_has_role('authenticator',to_regrole('center_mcp_oauth'),'MEMBER') END,
 'private_schema_exists',to_regnamespace('center_mcp') IS NOT NULL,
 'native_enums',(SELECT jsonb_agg(jsonb_build_object('type',t.typname,'label',e.enumlabel)) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
   JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='auth' AND t.typname LIKE 'oauth%')
) AS impact;
