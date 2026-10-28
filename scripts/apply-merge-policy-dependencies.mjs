import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectCommunityDb, communityProject } from './community-db.mjs';
const apply=process.argv.includes('--apply'),version='20261019040000',directory='artifacts/guest-program-merge/policy-dependencies';
const sql=(await readFile(`supabase/migrations/${version}_guest_merge_policy_dependencies.sql`,'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');
const sha256=createHash('sha256').update(sql).digest('hex');
const db=await connectCommunityDb();
await mkdir(directory,{recursive:true});
try{
 await db.query('BEGIN');await db.query('SET LOCAL ROLE postgres');
 await db.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='20s'");
 assert.equal((await db.query('SELECT count(*)::int n FROM supabase_migrations.schema_migrations WHERE version=$1',[version])).rows[0].n,0);
 assert.equal((await db.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='account_merge_worker'")).rows[0].rolcanlogin,false);
 const functions=['public.calendar_is_admin()','public.is_current_profile(uuid)','public.is_challenge_host(bigint)'];
 const grants=[];
 for(const signature of functions)grants.push({signature,allowed:(await db.query("SELECT has_function_privilege('account_merge_worker',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed});
 const original=(await db.query("SELECT pg_get_functiondef('public.prepare_offline_challenge_submission()'::regprocedure) AS definition")).rows[0].definition;
 const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM public.users) AS profiles,
   (SELECT count(*) FROM public.logs) AS logs,(SELECT count(*) FROM public.notice_responses) AS applications,
   (SELECT count(*) FROM public.daily_program_session_responses) AS session_applications,
   (SELECT count(*) FROM public.offline_challenge_submissions) AS offline_submissions,
   (SELECT count(*) FROM public.online_challenge_submissions) AS online_submissions,
   (SELECT count(*) FROM public.haifn_transactions) AS transactions`)).rows[0];
 const before=await counts();
 if(apply)assert.equal(JSON.parse(await readFile(`${directory}/dry-run.json`,'utf8')).sha256,sha256);
 await db.query(sql);
 assert.deepEqual(await counts(),before);
 await db.query('SET LOCAL ROLE account_merge_worker');
 const fakeSource='00000000-0000-4000-8000-000000000001',fakeTarget='00000000-0000-4000-8000-000000000002';
 await db.query("SELECT set_config('app.merge_source_id',$1,true),set_config('app.merge_target_id',$2,true)",[fakeSource,fakeTarget]);
 // EXPLAIN validates both policy planning and permission checks without running
 // these writes or looking up the failed user's records.
 let checks=0;
 for(const [table,column]of [['daily_program_session_responses','user_id'],['offline_challenge_submissions','participant_id'],['online_challenge_submissions','participant_id']]){
   await db.query(`EXPLAIN SELECT ctid FROM public.${table} WHERE ${column}=$1 FOR UPDATE`,[fakeSource]);checks++;
   await db.query(`EXPLAIN UPDATE public.${table} SET ${column}=$1 WHERE ctid=$2::tid`,[fakeTarget,'(0,0)']);checks++;
 }
 await db.query('SET LOCAL ROLE postgres');
 const restore=grants.filter(g=>!g.allowed).map(g=>`REVOKE EXECUTE ON FUNCTION ${g.signature} FROM account_merge_worker;`);
 restore.push(original+';');
 await writeFile(`${directory}/restore.sql`,'-- Restore prior internal-role permissions and trigger; preserve every record.\nBEGIN;\n'+restore.join('\n')+'\nCOMMIT;\n');
 if(apply)await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,'guest_merge_policy_dependencies',[sql]]);
 await db.query(apply?'COMMIT':'ROLLBACK');
 const result={status:apply?'applied':'dry_run_passed',project:communityProject,sha256,existingRecordsChanged:0,before,policyPlanChecks:checks};
 await writeFile(`${directory}/${apply?'applied':'dry-run'}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}
finally{await db.end();}
