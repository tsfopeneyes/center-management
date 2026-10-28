import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {connectCommunityDb,communityProject} from './community-db.mjs';

const apply=process.argv.includes('--apply'),version='20261014050000';
const sql=(await readFile(`supabase/migrations/${version}_guest_community_access.sql`,'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');
const sha256=createHash('sha256').update(sql).digest('hex');
const db=await connectCommunityDb();
const signatures=['public.can_access_community_channel(uuid,uuid)',
 'public.create_community_post_with_media(jsonb,boolean)','public.update_community_post_with_media(jsonb)',
 'public.update_online_challenge_post(uuid,uuid,text,uuid)','public.replace_community_post_media(uuid,uuid,text[],text[])',
 'public.mark_community_channel_read(uuid,uuid,timestamp with time zone)'];
const counts=async()=>(await db.query(`SELECT
 (SELECT count(*) FROM public.users) AS profiles,(SELECT count(*) FROM auth.users) AS accounts,
 (SELECT count(*) FROM public.notices) AS programs,(SELECT count(*) FROM public.notice_responses) AS applications,
 (SELECT count(*) FROM public.community_channels) AS channels,(SELECT count(*) FROM public.community_channel_posts) AS posts,
 (SELECT count(*) FROM public.community_channel_comments) AS comments,(SELECT count(*) FROM public.logs) AS logs`)).rows[0];
const identity=async()=>(await db.query(`SELECT p.oid::regprocedure::text AS signature,md5(pg_get_functiondef(p.oid)) AS hash
 FROM pg_proc p WHERE p.oid IN('public.current_profile_id()'::regprocedure,'public.is_current_profile(uuid)'::regprocedure,
 'account_security.current_profile_id()'::regprocedure) ORDER BY 1`)).rows;
try{
 await db.query('BEGIN');await db.query('SET LOCAL ROLE postgres');
 await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
 assert.equal((await db.query('SELECT count(*)::int AS count FROM supabase_migrations.schema_migrations WHERE version=$1',[version])).rows[0].count,0,'already applied');
 assert.equal((await db.query("SELECT to_regclass('community_security.guest_sessions') IS NULL AS absent")).rows[0].absent,true);
 const before=await counts(),identityBefore=await identity();
 const previous=[];
 for(const signature of signatures)previous.push((await db.query('SELECT pg_get_functiondef($1::regprocedure) AS definition',[signature])).rows[0].definition);
 const restore=`-- Disable guest access and restore member operations. Keep guest session/attempt history intact.\nBEGIN;\n`+
 `REVOKE EXECUTE ON FUNCTION community_security.guest_action(text,uuid,text,jsonb),community_security.verify_guest(uuid,text,text,text,text,text) FROM community_guest_worker;\n`+
 previous.map(definition=>definition+';').join('\n')+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n";
 await writeFile(`artifacts/program-community/restore-${version}.sql`,restore);
 await db.query(sql);
 assert.deepEqual(await counts(),before,'existing record counts changed');
 assert.deepEqual(await identity(),identityBefore,'global account identity functions changed');
 const permissions=(await db.query(`SELECT
 NOT has_table_privilege('anon','community_security.guest_sessions','SELECT') AS private_sessions,
 NOT has_table_privilege('community_guest_worker','public.users','SELECT') AS no_member_directory,
 NOT has_function_privilege('authenticated','community_security.verify_guest(uuid,text,text,text,text,text)','EXECUTE') AS no_public_worker,
 has_function_privilege('community_guest_worker','community_security.verify_guest(uuid,text,text,text,text,text)','EXECUTE') AS worker_verify,
 has_function_privilege('authenticated','public.create_community_post_with_media(jsonb,boolean)','EXECUTE') AS member_create_preserved,
 (SELECT NOT rolcanlogin AND NOT rolinherit FROM pg_roles WHERE rolname='community_guest_worker') AS worker_no_login`)).rows[0];
 assert.ok(Object.values(permissions).every(Boolean),JSON.stringify(permissions));
 if(apply){
  const dry=JSON.parse(await readFile(`artifacts/program-community/dry-run-${version}.json`,'utf8'));
  assert.equal(dry.sha256,sha256,'migration changed after dry run');
  await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,'guest_community_access',[sql]]);
 }
 await db.query(apply?'COMMIT':'ROLLBACK');
 const result={status:apply?'applied':'dry_run_passed',project:communityProject,sha256,before,permissions,identityBefore};
 await writeFile(`artifacts/program-community/${apply?'applied':'dry-run'}-${version}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){await db.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({status:'failed',code:error.code,message:error.message,position:error.position,where:error.where}));process.exitCode=1;}
finally{await db.end();}
