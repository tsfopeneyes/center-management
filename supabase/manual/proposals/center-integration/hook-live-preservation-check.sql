BEGIN READ ONLY;
SET LOCAL statement_timeout='5000ms';
WITH inputs AS (
 SELECT jsonb_build_object('claims',jsonb_build_object('sub',s.user_id::text,
   'session_id',s.id::text,'aud','authenticated','role','authenticated'),
   'client_id',s.oauth_client_id) AS event
 FROM auth.sessions s ORDER BY s.created_at DESC LIMIT 50
)
 , results AS (SELECT count(*) AS tested_sessions,
 count(*) FILTER (WHERE center_integration.composed_access_claims(event)
 IS DISTINCT FROM center_mcp.apply_access_claims(event)) AS changed_existing_results
FROM inputs)
SELECT tested_sessions, changed_existing_results,
 has_schema_privilege('supabase_auth_admin','center_integration','USAGE')
 AND has_function_privilege('supabase_auth_admin','center_integration.composed_access_claims(jsonb)','EXECUTE') AS auth_service_can_execute,
 center_integration.composed_access_claims(
 '{"claims":{"sub":"00000000-0000-4000-8000-000000000001","aud":"authenticated","role":"authenticated"}}'::jsonb
)->'claims'->>'role' AS ordinary_role FROM results;
ROLLBACK;
