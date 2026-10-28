// Structural proposal + synthetic SQL Hook assertions in ONE rollback-only
// transaction. No production account/student/session rows are read or written.
import {readFile,writeFile} from 'node:fs/promises';
const proposal=await readFile('supabase/manual/proposals/20261006_center_mcp_readonly.sql','utf8');
if(!/COMMIT;\s*$/.test(proposal))throw new Error('Expected one proposal transaction');
const hook=proposal.slice(proposal.indexOf('CREATE FUNCTION center_mcp.apply_access_claims'),proposal.indexOf('REVOKE ALL ON FUNCTION center_mcp.apply_access_claims'));
const fixtureHook=hook.replace('center_mcp.apply_access_claims','center_mcp.fixture_apply_access_claims')
 .replaceAll('account_security.accounts','pg_temp.mcp_accounts').replaceAll('account_security.account_roles','pg_temp.mcp_roles')
 .replaceAll('auth.oauth_authorizations','pg_temp.mcp_authorizations').replaceAll('auth.sessions','pg_temp.mcp_sessions');
const assertions=`
CREATE TEMP TABLE mcp_accounts(auth_user_id uuid,profile_id uuid,mapping_verified boolean,status text,must_change_password boolean,credential_version integer);
CREATE TEMP TABLE mcp_roles(profile_id uuid,role text,enabled boolean);
CREATE TEMP TABLE mcp_authorizations(authorization_id text,client_id uuid,user_id uuid,status text,approved_at timestamptz);
CREATE TEMP TABLE mcp_sessions(id uuid,user_id uuid,oauth_client_id uuid,created_at timestamptz);
${fixtureHook}
DO $test$ DECLARE event jsonb; output jsonb; ordinary jsonb; BEGIN
 ordinary:=jsonb_build_object('authentication_method','password','claims',jsonb_build_object('aud','authenticated','role','authenticated','sub','00000000-0000-4000-8000-000000000001','custom_existing',true));
 IF center_mcp.apply_access_claims(ordinary) IS DISTINCT FROM ordinary THEN RAISE EXCEPTION 'ordinary login claims changed'; END IF;
 event:=jsonb_build_object('client_id','914be882-969c-408f-9609-57a3534cc9b5','authentication_method','oauth_provider/authorization_code','claims',jsonb_build_object('aud','authenticated','role','authenticated','sub','00000000-0000-4000-8000-000000000001','session_id','00000000-0000-4000-8000-000000000003','custom_existing',true));
 output:=center_mcp.apply_access_claims(event);
 IF output#>>'{claims,role}'<>'center_mcp_oauth' OR output#>'{claims,center_permissions}'<>'[]'::jsonb OR output#>'{claims,custom_existing}'<>'true'::jsonb THEN RAISE EXCEPTION 'disabled dedicated client did not isolate or preserve claims'; END IF;
 IF pg_has_role('authenticator','center_mcp_oauth','MEMBER') THEN RAISE EXCEPTION 'PostgREST can assume OAuth role'; END IF;
 IF has_column_privilege('center_statistics_reader','public.users','name','SELECT') OR has_table_privilege('center_statistics_reader','public.logs','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'reader has excessive rights'; END IF;
 IF has_function_privilege('authenticated','center_mcp.apply_access_claims(jsonb)','EXECUTE') OR NOT has_function_privilege('supabase_auth_admin','center_mcp.apply_access_claims(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Hook execution ACL wrong'; END IF;
 UPDATE center_mcp.configuration SET auth_user_id='00000000-0000-4000-8000-000000000001',profile_id='00000000-0000-4000-8000-000000000002',credential_version=3,enabled=true;
 INSERT INTO pg_temp.mcp_accounts VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true,'active',false,3);
 INSERT INTO pg_temp.mcp_roles VALUES('00000000-0000-4000-8000-000000000002','master',true);
 INSERT INTO pg_temp.mcp_authorizations VALUES('synthetic-check','914be882-969c-408f-9609-57a3534cc9b5','00000000-0000-4000-8000-000000000001','approved',now());
 INSERT INTO pg_temp.mcp_sessions VALUES('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','914be882-969c-408f-9609-57a3534cc9b5',now());
 INSERT INTO center_mcp.consent_proofs(authorization_id,client_id,auth_user_id,profile_id,website_session_id,credential_version) VALUES('synthetic-check','914be882-969c-408f-9609-57a3534cc9b5','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004',3);
 output:=center_mcp.fixture_apply_access_claims(event);
 IF output#>'{claims,center_permissions}'<>'["center:statistics:read","center:programs:read"]'::jsonb OR output#>>'{claims,center_credential_version}'<>'3' THEN RAISE EXCEPTION 'verified synthetic proof denied'; END IF;
 UPDATE pg_temp.mcp_accounts SET credential_version=4;
 IF center_mcp.fixture_apply_access_claims(event)#>'{claims,center_permissions}'<>'[]'::jsonb THEN RAISE EXCEPTION 'stale epoch allowed'; END IF;
 UPDATE pg_temp.mcp_accounts SET credential_version=3;
 UPDATE center_mcp.consent_proofs SET revoked_at=now();
 IF center_mcp.fixture_apply_access_claims(event)#>'{claims,center_permissions}'<>'[]'::jsonb THEN RAISE EXCEPTION 'revoked proof allowed'; END IF;
 IF center_mcp.fixture_apply_access_claims(jsonb_set(event,'{claims,sub}','"00000000-0000-4000-8000-000000000099"'::jsonb))#>'{claims,center_permissions}'<>'[]'::jsonb THEN RAISE EXCEPTION 'other user allowed'; END IF;
END $test$;
SET LOCAL ROLE center_statistics_reader;
EXPLAIN (FORMAT JSON) SELECT id,role FROM public.staff_directory LIMIT 0;
RESET ROLE;
ROLLBACK;
SELECT jsonb_build_object('schema_rolled_back',to_regnamespace('center_mcp') IS NULL,'role_rolled_back',to_regrole('center_statistics_reader') IS NULL,'assertions_passed',true) AS verification;
`;
const sql=proposal.replace(/COMMIT;\s*$/,'')+assertions;
if(/\bCOMMIT\s*;/i.test(sql))throw new Error('Refuse commit in synthetic check');
await writeFile('supabase/manual/proposals/20261006_center_mcp_sql_acceptance.sql',sql);
console.log('Rollback-only SQL acceptance generated; positive Hook fixture uses TEMP rows');
