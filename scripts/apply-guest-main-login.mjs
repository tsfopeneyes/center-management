import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {connectCommunityDb,communityProject} from './community-db.mjs';
const apply=process.argv.includes('--apply'),version='20261014060000';
const sql=(await readFile(`supabase/migrations/${version}_guest_main_login.sql`,'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');
const sha256=createHash('sha256').update(sql).digest('hex'),db=await connectCommunityDb();
const signatures=['public.can_access_community_channel(uuid,uuid)','public.create_community_post_with_media(jsonb,boolean)',
 'public.update_community_post_with_media(jsonb)','public.update_online_challenge_post(uuid,uuid,text,uuid)',
 'public.replace_community_post_media(uuid,uuid,text[],text[])','public.mark_community_channel_read(uuid,uuid,timestamptz)'];
const counts=async()=>(await db.query(`SELECT
 (SELECT count(*) FROM public.users) AS profiles,(SELECT count(*) FROM auth.users) AS native_accounts,
 (SELECT count(*) FROM account_security.accounts) AS protected_accounts,
 (SELECT count(*) FROM public.notices) AS programs,(SELECT count(*) FROM public.notice_responses) AS applications,
 (SELECT count(*) FROM public.community_channel_posts) AS posts,(SELECT count(*) FROM public.community_channel_comments) AS comments,
 (SELECT count(*) FROM public.logs) AS raw_logs,(SELECT count(*) FROM community_security.guest_sessions) AS old_guest_sessions`)).rows[0];
const identity=async()=>(await db.query(`SELECT p.oid::regprocedure::text AS signature,md5(pg_get_functiondef(p.oid)) AS hash
 FROM pg_proc p WHERE p.oid IN('public.current_profile_id()'::regprocedure,'public.is_current_profile(uuid)'::regprocedure,
 'account_security.current_profile_id()'::regprocedure) ORDER BY 1`)).rows;
try{
 await db.query('BEGIN');await db.query('SET LOCAL ROLE postgres');
 await db.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='45s'");
 assert.equal((await db.query('SELECT count(*)::int AS n FROM supabase_migrations.schema_migrations WHERE version=$1',[version])).rows[0].n,0);
 assert.equal((await db.query("SELECT to_regclass('account_security.guest_login_profiles') IS NULL AS absent")).rows[0].absent,true);
 const before=await counts(),identityBefore=await identity(),previous=[];
 const bindings=(await db.query("SELECT id,auth_user_id,created_at FROM public.users WHERE user_group='게스트' ORDER BY id")).rows;
 const expected=(await db.query(`SELECT count(*)::int AS n FROM public.users u LEFT JOIN account_security.account_roles r ON r.profile_id=u.id
 WHERE u.user_group='게스트' AND u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
 AND lower(COALESCE(u.role,'')) NOT IN('admin','master','manager','staff','rok') AND NOT COALESCE(u.is_master,false)
 AND (r.profile_id IS NULL OR r.role='member' AND r.enabled)
 AND NOT EXISTS(SELECT 1 FROM account_security.membership_receipts mr WHERE mr.profile_id=u.id)`)).rows[0].n;
 for(const signature of signatures)previous.push((await db.query('SELECT pg_get_functiondef($1::regprocedure) AS definition',[signature])).rows[0].definition);
 await writeFile(`artifacts/program-community/bindings-before-${version}.json`,JSON.stringify({project:communityProject,bindings},null,2));
 const restore=`-- Emergency guest feature disable. Preserve all profiles, native accounts and audit records.\nBEGIN;\n`+
 `UPDATE account_security.guest_login_profiles SET enabled=false,revoked_at=COALESCE(revoked_at,clock_timestamp());\n`+
 previous.map(x=>x+';').join('\n')+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n";
 await writeFile(`artifacts/program-community/restore-${version}.sql`,restore);
 await db.query(sql);
 assert.deepEqual(await counts(),before,'existing record counts changed');assert.deepEqual(await identity(),identityBefore,'global identity functions changed');
 assert.deepEqual((await db.query("SELECT id,auth_user_id,created_at FROM public.users WHERE user_group='게스트' ORDER BY id")).rows,bindings,'migration must not create or relink guest Auth accounts');
 const enrolled=(await db.query('SELECT count(*)::int AS n FROM account_security.guest_login_profiles WHERE enabled')).rows[0].n;assert.equal(enrolled,expected);
 const permissions=(await db.query(`SELECT
 NOT has_table_privilege('account_guest_login_worker','public.users','SELECT') AS no_raw_directory,
 NOT has_table_privilege('authenticated','account_security.guest_login_profiles','SELECT') AS private_registry,
 NOT has_function_privilege('authenticated','account_security.prepare_guest_login(uuid,text,text,text,text,text,uuid,text)','EXECUTE') AS private_verification,
 NOT has_function_privilege('community_guest_worker','community_security.guest_action(text,uuid,text,jsonb)','EXECUTE') AS retired_separate_guest_session,
 has_function_privilege('account_guest_login_worker','account_security.finalize_guest_login(uuid,uuid,uuid,text,text,timestamptz)','EXECUTE') AS worker_can_finalize,
 has_function_privilege('authenticated','public.create_community_post_with_media(jsonb,boolean)','EXECUTE') AS member_api_preserved,
 (SELECT NOT rolcanlogin AND NOT rolinherit AND NOT rolbypassrls FROM pg_roles WHERE rolname='account_guest_login_worker') AS restricted_worker`)).rows[0];
 assert.ok(Object.values(permissions).every(Boolean),JSON.stringify(permissions));
 if(apply){const dry=JSON.parse(await readFile(`artifacts/program-community/dry-run-${version}.json`,'utf8'));assert.equal(dry.sha256,sha256);assert.equal(dry.enrolled,enrolled);
 await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,'guest_main_login',[sql]]);}
 await db.query(apply?'COMMIT':'ROLLBACK');
 const result={status:apply?'applied':'dry_run_passed',project:communityProject,sha256,before,enrolled,permissions,identityBefore};
 await writeFile(`artifacts/program-community/${apply?'applied':'dry-run'}-${version}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await db.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({status:'failed',code:error.code,message:error.message,where:error.where}));process.exitCode=1;}
finally{await db.end();}
