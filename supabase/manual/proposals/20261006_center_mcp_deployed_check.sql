-- Newly-created MCP state / permission booleans only. No user/raw/token rows.
SELECT jsonb_build_object(
 'configuration_disabled',(SELECT NOT enabled FROM center_mcp.configuration WHERE singleton),
 'identity_unbound',(SELECT auth_user_id IS NULL AND profile_id IS NULL FROM center_mcp.configuration WHERE singleton),
 'client_matches',(SELECT client_id='914be882-969c-408f-9609-57a3534cc9b5'::uuid FROM center_mcp.configuration WHERE singleton),
 'reader_no_raw_name',NOT has_column_privilege('center_statistics_reader','public.users','name','SELECT'),
 'reader_no_raw_writes',NOT has_table_privilege('center_statistics_reader','public.logs','INSERT,UPDATE,DELETE'),
 'oauth_role_unavailable_to_postgrest',NOT pg_has_role('authenticator','center_mcp_oauth','MEMBER'),
 'hook_private',NOT has_function_privilege('authenticated','center_mcp.apply_access_claims(jsonb)','EXECUTE'),
 'hook_available_to_auth',has_function_privilege('supabase_auth_admin','center_mcp.apply_access_claims(jsonb)','EXECUTE'),
 'dedicated_disabled_scope_empty',(center_mcp.apply_access_claims('{"client_id":"914be882-969c-408f-9609-57a3534cc9b5","claims":{"role":"authenticated","aud":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}}'::jsonb)#>'{claims,center_permissions}')='[]'::jsonb,
 'ordinary_login_unchanged',center_mcp.apply_access_claims('{"claims":{"role":"authenticated","aud":"authenticated","custom_existing":true}}'::jsonb)='{"claims":{"role":"authenticated","aud":"authenticated","custom_existing":true}}'::jsonb
) AS verification;
