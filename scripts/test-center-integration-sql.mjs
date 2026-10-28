import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE supabase_auth_admin; CREATE ROLE authenticator;
CREATE SCHEMA account_security; CREATE SCHEMA auth;
CREATE TABLE account_security.accounts(auth_user_id uuid,profile_id uuid,mapping_verified boolean,status text,credential_version integer,must_change_password boolean);
CREATE TABLE account_security.account_roles(profile_id uuid,role text,enabled boolean);
CREATE TABLE auth.oauth_authorizations(authorization_id text,client_id uuid,user_id uuid,status text,resource text,redirect_uri text,code_challenge_method text,expires_at timestamptz);
CREATE TABLE auth.oauth_consents(user_id uuid,client_id uuid,revoked_at timestamptz);
CREATE TABLE auth.sessions(id uuid,user_id uuid,oauth_client_id uuid,not_after timestamptz);
CREATE TABLE auth.oauth_clients(id uuid,deleted_at timestamptz);
CREATE TABLE public.users(id uuid,user_group text,name text);
CREATE TABLE public.staff_directory(id uuid,role text);
CREATE TABLE public.locations(id text,name text);
CREATE TABLE public.logs(id bigint,user_id uuid,type text,location_id text,created_at timestamptz);
CREATE TABLE public.notices(id bigint,category text,program_date timestamptz,created_at timestamptz,program_status text,is_recruiting boolean,guest_properties jsonb,program_location text);
CREATE TABLE public.notice_responses(notice_id bigint,user_id uuid,status text,is_attended boolean,is_staff boolean);
CREATE TABLE public.daily_program_sessions(id uuid,notice_id bigint,session_date date,status text,voided_at timestamptz);
CREATE TABLE public.daily_program_session_responses(session_id uuid,user_id uuid,status text,is_attended boolean);
CREATE TABLE public.open_program_attendance(notice_id bigint,user_id uuid,attendance_date date);
CREATE TABLE public.schools(id uuid,region text);
CREATE TABLE public.rentals(id uuid,school_id uuid);
CREATE TABLE public.rental_bookings(id uuid,booking_date date,status text,rental_id uuid);
CREATE TABLE public.store_orders(id uuid,created_at timestamptz,status text);
CREATE TABLE public.checkin_surveys(id uuid,created_at timestamptz,survey_type text,aggregation_excluded boolean,location_id text);
CREATE TABLE public.survey_entries(id uuid,notice_id bigint,version_id uuid,answers jsonb,created_at timestamptz,aggregation_excluded boolean);
CREATE TABLE public.survey_versions(id uuid,definition jsonb);
CREATE TABLE public.program_feedback(id uuid,notice_id bigint,q3_satisfaction integer,created_at timestamptz,aggregation_excluded boolean);
`);
await db.exec(await readFile('supabase/manual/proposals/center-integration/20261006_center_integration_v1.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261007030000_center_integration_settings_read.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261007040000_center_integration_auth_projections.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261007050000_center_consent_authorization_check.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261007060000_center_oauth_consumed_authorization.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261007070000_center_operating_context.sql','utf8'));
await db.exec(`ALTER TABLE public.notices ADD COLUMN title text, ADD COLUMN is_private boolean, ADD COLUMN is_leader_only boolean;`);
await db.exec(await readFile('supabase/migrations/20261007080000_center_program_catalog_sync.sql','utf8'));
await db.exec(`INSERT INTO public.notices(id,title,category,program_date,program_status,is_recruiting) VALUES(1001,'공개 프로그램','PROGRAM',now(),'ACTIVE',true);
INSERT INTO public.notices(id,title,category,is_private) VALUES(1002,'비공개 프로그램','PROGRAM',true);
INSERT INTO public.notices(id,title,category,is_leader_only) VALUES(1003,'리더 전용','PROGRAM',true);`);
assert.equal((await db.query(`SELECT count(*)::int AS count FROM center_integration.program_catalog WHERE published`)).rows[0].count,1);
await db.exec(`UPDATE public.notices SET title='변경된 공개 프로그램' WHERE id=1001;`);
assert.equal((await db.query(`SELECT title FROM center_integration.program_catalog WHERE program_ref='1001'`)).rows[0].title,'변경된 공개 프로그램');
await db.exec(`UPDATE public.notices SET is_private=true WHERE id=1001;`);
assert.equal((await db.query(`SELECT published FROM center_integration.program_catalog WHERE program_ref='1001'`)).rows[0].published,false);
console.log('PASS program catalog automatic publication, rename sync, and private/leader exclusion');
await db.exec(await readFile('supabase/migrations/20261007090000_center_operator_program_scope.sql','utf8'));
assert.equal((await db.query(`SELECT count(*)::int AS count FROM center_integration.program_catalog WHERE published`)).rows[0].count,3);
await db.exec(`UPDATE public.notices SET category='GENERAL' WHERE id=1003;`);
assert.equal((await db.query(`SELECT published FROM center_integration.program_catalog WHERE program_ref='1003'`)).rows[0].published,false);
console.log('PASS final operator scope includes private and leader-only programs and still excludes non-program records');
await db.exec(`INSERT INTO public.locations VALUES('2F 스퀘어','하이픈'),('ENOUGH_PLACE','이높플레이스'),('unknown','기타');
UPDATE public.notices SET program_location='하이픈 2F SQUARE' WHERE id=1001;
UPDATE public.notices SET program_location='이높플레이스' WHERE id=1002;`);
await db.exec(await readFile('supabase/migrations/20261008010000_center_analysis_site_scope.sql','utf8'));
assert.deepEqual((await db.query(`SELECT site FROM center_integration.analysis_locations ORDER BY id`)).rows.map(row=>row.site),['HAIFN','ENOUGH_PLACE',null]);
assert.deepEqual((await db.query(`SELECT site FROM center_integration.analysis_notices WHERE id IN(1001,1002) ORDER BY id`)).rows.map(row=>row.site),['HAIFN','ENOUGH_PLACE']);
assert.equal((await db.query(`SELECT count(*)::int AS count FROM public.notices`)).rows[0].count,3);
await db.exec(`INSERT INTO public.schools VALUES('00000000-0000-4000-8000-000000000011','강동'),('00000000-0000-4000-8000-000000000012','강서');
INSERT INTO public.rentals VALUES('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011');
INSERT INTO public.rental_bookings VALUES('00000000-0000-4000-8000-000000000031','2026-07-01','CONFIRMED','00000000-0000-4000-8000-000000000021');
INSERT INTO public.checkin_surveys VALUES('00000000-0000-4000-8000-000000000041',now(),'CHECKIN',false,'ENOUGH_PLACE');`);
assert.equal((await db.query(`SELECT site FROM center_integration.analysis_rental_bookings`)).rows[0].site,'HAIFN');
assert.equal((await db.query(`SELECT site FROM center_integration.analysis_checkin_surveys`)).rows[0].site,'ENOUGH_PLACE');
assert.equal((await db.query(`SELECT has_table_privilege('center_integration_token','center_integration.analysis_locations','SELECT') AS allowed`)).rows[0].allowed,false);
console.log('PASS derived site views, rental/survey joins, raw row preservation and private privilege boundary');

assert.equal((await db.query(`SELECT has_table_privilege('center_integration_reader','center_integration.operating_context','SELECT') AS allowed`)).rows[0].allowed,true);
assert.equal((await db.query(`SELECT has_table_privilege('center_integration_token','center_integration.operating_context','SELECT') AS allowed`)).rows[0].allowed,false);
const q = async sql => (await db.query(sql)).rows[0];
assert.equal((await q(`SELECT enabled FROM center_integration.settings`)).enabled,false);
assert.equal((await q(`SELECT has_column_privilege('center_integration_reader','public.users','name','SELECT') AS allowed`)).allowed,false);
assert.equal((await q(`SELECT has_table_privilege('center_integration_reader','center_integration.analysis_logs','SELECT') AS allowed`)).allowed,true);
assert.equal((await q(`SELECT pg_has_role('authenticator','center_integration_token','MEMBER') AS allowed`)).allowed,false);
assert.equal((await q(`SELECT has_function_privilege('authenticated','center_integration.apply_access_claims(jsonb)','EXECUTE') AS allowed`)).allowed,false);
const client='00000000-0000-4000-8000-000000000001';
const user='00000000-0000-4000-8000-000000000002';
await db.query(`INSERT INTO center_integration.clients(client_id,client_label,resource,issuer,redirect_uris) VALUES($1,'Synthetic','https://example.test/mcp','https://example.test/auth',ARRAY['https://example.test/callback'])`,[client]);
const ordinary={claims:{sub:user,aud:'authenticated',role:'authenticated',custom:true}};
const invoke=async event=>(await db.query(`SELECT center_integration.apply_access_claims($1::jsonb) AS result`,[JSON.stringify(event)])).rows[0].result;
assert.deepEqual(await invoke(ordinary),ordinary);
const isolated=await invoke({...ordinary,client_id:client});
assert.equal(isolated.claims.role,'center_integration_token');
assert.equal(isolated.claims.aud,'https://example.test/mcp');
assert.deepEqual(isolated.claims.center_permissions,[]);
assert.equal(isolated.claims.custom,true);
const profile='00000000-0000-4000-8000-000000000003';
const session='00000000-0000-4000-8000-000000000004';
await db.query(`INSERT INTO account_security.accounts VALUES($1,$2,true,'active',1,false)`,[user,profile]);
await db.query(`INSERT INTO account_security.account_roles VALUES($1,'admin',true)`,[profile]);
await db.query(`INSERT INTO auth.oauth_clients VALUES($1,NULL)`,[client]);
await db.query(`INSERT INTO auth.oauth_authorizations VALUES('test-consent',$1,$2,'approved','https://example.test/mcp','https://example.test/callback','S256',now()+interval '1 hour')`,[client,user]);
await db.query(`INSERT INTO auth.oauth_consents VALUES($1,$2,NULL)`,[user,client]);
await db.query(`INSERT INTO auth.sessions VALUES($1,$2,$3,NULL)`,[session,user,client]);
await db.query(`INSERT INTO center_integration.connections(auth_user_id,profile_id,client_id,state,capabilities,native_authorization_id,grant_version,credential_version,consented_at) VALUES($1,$2,$3,'active',ARRAY['analytics.read','programs.read'],'test-consent',1,1,now())`,[user,profile,client]);
await db.query(`UPDATE center_integration.settings SET enabled=true,pilot_profile_ids=ARRAY[$1::uuid]`,[profile]);
await db.query(`UPDATE center_integration.clients SET enabled=true WHERE client_id=$1`,[client]);
await db.exec(`ALTER TABLE account_security.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_security.account_roles ENABLE ROW LEVEL SECURITY;
REVOKE USAGE ON SCHEMA auth FROM center_integration_reader;
BEGIN READ ONLY; SET LOCAL ROLE center_integration_reader;`);
assert.equal((await q(`SELECT count(*)::int AS count FROM center_integration.account_state`)).count,1);
assert.equal((await q(`SELECT count(*)::int AS count FROM center_integration.auth_sessions`)).count,1);
assert.equal((await q(`SELECT enabled FROM center_integration.settings WHERE singleton`)).enabled,true);
await db.exec(`ROLLBACK;`);
assert.equal((await q(`SELECT has_table_privilege('center_integration_token','center_integration.account_state','SELECT') AS allowed`)).allowed,false);
const { createConnectionStore } = await import('../supabase/functions/_shared/centerIntegration/connectionStore.mjs');
const store = createConnectionStore({ withControlTransaction: async operation => {
    await db.exec('BEGIN; SET LOCAL ROLE center_integration_control_writer;');
    try {
        const result = await operation((sql, values = []) => db.query(sql, values));
        await db.exec('COMMIT;');
        return result;
    } catch (error) { await db.exec('ROLLBACK;'); throw error; }
} });
const prepared = await store.createConsentRequest({
    id: '00000000-0000-4000-8000-000000000005', authorizationId: 'test-consent',
    authUserId: user, profileId: profile, clientId: client,
    redirectUri: 'https://example.test/callback', resource: 'https://example.test/mcp',
    capabilities: ['analytics.read', 'programs.read'], credentialVersion: 1,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
});
const pendingRetry = await store.createConsentRequest({
    id: '00000000-0000-4000-8000-000000000007', authorizationId: 'test-consent',
    authUserId: user, profileId: profile, clientId: client,
    redirectUri: 'https://example.test/callback', resource: 'https://example.test/mcp',
    capabilities: ['analytics.read', 'programs.read'], credentialVersion: 1,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
});
assert.equal(pendingRetry.request_id, prepared.request_id);
console.log('PASS repeated pending consent preparation preserves the original request ID');
assert.equal((await store.activateConsentRequest({ requestId: prepared.request_id,
    authorizationId: 'test-consent', authUserId: user, profileId: profile,
    clientId: client, credentialVersion: 1 })).state, 'active');
console.log('PASS actual consent prepare and activate SQL under the production control role');
const priorVersion=(await db.query(`SELECT grant_version FROM center_integration.connections WHERE client_id=$1`,[client])).rows[0].grant_version;
const retried=await store.createConsentRequest({ id:'00000000-0000-4000-8000-000000000006',
 authorizationId:'test-consent',authUserId:user,profileId:profile,clientId:client,
 redirectUri:'https://example.test/callback',resource:'https://example.test/mcp',
 capabilities:['analytics.read','programs.read'],credentialVersion:1,expiresAt:new Date(Date.now()+3600000).toISOString() });
assert.equal(retried.request_id,prepared.request_id);
assert.ok(await store.loadPendingConsentRequest({ requestId:retried.request_id,authUserId:user,profileId:profile }));
assert.equal((await store.activateConsentRequest({ requestId:retried.request_id,authorizationId:'test-consent',authUserId:user,profileId:profile,clientId:client,credentialVersion:1 })).grant_version,priorVersion);
console.log('PASS completed OAuth reconnection retries are idempotent and do not invalidate issued tokens');
const approved={...ordinary,client_id:client,claims:{...ordinary.claims,session_id:session}};
assert.deepEqual((await invoke(approved)).claims.center_permissions,['analytics.read','programs.read']);
await db.exec(`DELETE FROM auth.oauth_authorizations`);
assert.deepEqual((await invoke(approved)).claims.center_permissions,['analytics.read','programs.read']);
console.log('PASS consumed authorization preserves active consent while native revoke still denies access');
await db.exec(`UPDATE auth.oauth_consents SET revoked_at=now()`);
assert.deepEqual((await invoke(approved)).claims.center_permissions,[]);
await db.exec(`UPDATE auth.oauth_consents SET revoked_at=NULL; UPDATE account_security.accounts SET credential_version=2`);
assert.deepEqual((await invoke(approved)).claims.center_permissions,[]);
assert.equal((await q(`SELECT state FROM center_integration.connections`)).state,'revoke_pending');
await assert.rejects(db.exec(`UPDATE center_integration.connections SET state='active'`),/revocation must finish/);
console.log('PASS approved Hook grants, native revoke denial, credential-change invalidation and reactivation prevention');
console.log('PASS isolated PostgreSQL proposal, default-disabled state, reader ACL, token role isolation, Hook ACL, ordinary claims preservation, no-consent token denial');
} catch(error) { console.error('SQL CHECK FAILED', error.code, error.message); process.exitCode=1; }
finally { await db.close(); }
