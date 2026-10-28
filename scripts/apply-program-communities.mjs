import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectCommunityDb, communityProject } from './community-db.mjs';

const apply=process.argv.includes('--apply');
const filename=process.argv.find(arg=>arg.startsWith('--migration='))?.slice(12)||'20261014010000_program_communities.sql';
if(!['20261014010000_program_communities.sql','20261014020000_session_community_opening.sql','20261014030000_community_member_rejoin.sql'].includes(filename)) throw new Error('Unexpected migration');
const version=filename.slice(0,14);
const artifactSuffix=version==='20261014010000'?'':('-'+version);
const sql=(await readFile(`supabase/migrations/${filename}`,'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');
const sha256=createHash('sha256').update(sql).digest('hex');
const db=await connectCommunityDb();
const counts=async()=> (await db.query(`SELECT
 (SELECT count(*) FROM public.notices) AS notices,(SELECT count(*) FROM public.notice_responses) AS applications,
 (SELECT count(*) FROM public.community_channels) AS channels,(SELECT count(*) FROM public.community_channel_members) AS members,
 (SELECT count(*) FROM public.community_channel_posts) AS posts,(SELECT count(*) FROM public.community_channel_comments) AS comments,
 (SELECT count(*) FROM public.community_post_media) AS photos,(SELECT count(*) FROM public.online_challenge_submissions) AS submissions,
 (SELECT count(*) FROM public.challenge_completion_rewards) AS rewards,(SELECT count(*) FROM public.logs) AS logs`)).rows[0];
try {
 await db.query('BEGIN'); await db.query('SET LOCAL ROLE postgres');
 await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
 assert.equal((await db.query("SELECT count(*)::int AS count FROM supabase_migrations.schema_migrations WHERE version=$1",[version])).rows[0].count,0,'already applied');
 const before=await counts();
 const functions=(await db.query(`SELECT pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN('public','community_security') AND proname IN('can_access_community_channel','sync_notice_community_channel','detach_notice_community_channel',
  'link_community_channel_to_notice','is_joinable_standalone_channel','queue_community_post_push','queue_community_comment_push','effective_status','guard_channel_status')`)).rows;
 const policies=(await db.query(`SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public'
  AND policyname IN('channel_posts_insert','channel_comments_insert')`)).rows;
 const trigger=(await db.query("SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgname='trg_sync_notice_community_channel' AND NOT tgisinternal")).rows[0];
 const rollback=[...functions.map(f=>f.definition+';'),
   ...(version==='20261014010000' ? [...policies.map(p=>`DROP POLICY IF EXISTS ${p.policyname} ON public.${p.tablename};\nCREATE POLICY ${p.policyname} ON public.${p.tablename} AS ${p.permissive} FOR ${p.cmd} TO ${(Array.isArray(p.roles)?p.roles:p.roles.replace(/[{}]/g,'').split(',')).map(r=>'"'+r+'"').join(',')} ${p.qual?'USING ('+p.qual+')':''} ${p.with_check?'WITH CHECK ('+p.with_check+')':''};`),
   'DROP POLICY IF EXISTS community_members_self_rejoin ON public.community_channel_members;',
   'DROP POLICY IF EXISTS community_members_self_leave ON public.community_channel_members;',
   'DROP TRIGGER IF EXISTS guard_program_community_status ON public.community_channels;',
   'DROP TRIGGER IF EXISTS trg_sync_notice_community_channel ON public.notices;',trigger.definition+';'] : version==='20261014030000' ? ['DROP POLICY IF EXISTS community_members_own_read ON public.community_channel_members;'] : [])];
 await mkdir('artifacts/program-community',{recursive:true});
 await writeFile(`artifacts/program-community/restore-functions${artifactSuffix}.sql`,'-- Restore previous behavior without deleting any records or new request history.\nBEGIN;\n'+rollback.join('\n')+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n");
 await db.query(sql);
 assert.deepEqual(await counts(),before,'protected record counts changed');
 await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',true),set_config('request.jwt.claim.role','service_role',true)");
 await db.query('SET LOCAL ROLE service_role');
 const state=(await db.query(`SELECT c.id,c.name,c.status AS stored_status,d.status AS effective_status,c.source_notice_id,
  d.participant_count,(SELECT count(*) FROM public.community_channel_members m WHERE m.channel_id=c.id AND m.revoked_at IS NULL) AS direct_members
  FROM public.community_channels c LEFT JOIN public.community_channel_directory d ON d.id=c.id ORDER BY c.created_at`)).rows;
 // Execute new projections as service role without impersonating a member or writing test production records.
 assert.equal(state.length,Number(before.channels));
 assert.ok(state.every(row=>row.effective_status!==null),'service-role channel projection missing');
 await db.query('SELECT count(*) FROM public.community_channel_participants');
 await db.query('SELECT count(*) FROM public.community_channel_invites');
 await db.query('SET LOCAL ROLE postgres');
 const permissions=(await db.query(`SELECT
  has_table_privilege('anon','public.community_channel_invites','SELECT') AS public_preview,
  NOT has_table_privilege('anon','public.community_channel_participants','SELECT') AS private_roster,
  NOT has_function_privilege('authenticated','community_security.member_ids(uuid)','EXECUTE') AS private_membership,
  has_table_privilege('authenticated','public.community_post_create_requests','INSERT') AS atomic_table_interface`)).rows[0];
 assert.ok(Object.values(permissions).every(Boolean), JSON.stringify(permissions));
 await db.query('SET LOCAL ROLE postgres');
 if(apply) {
   const checked=JSON.parse(await readFile(`artifacts/program-community/dry-run${artifactSuffix}.json`,'utf8'));
   assert.equal(checked.sha256,sha256,'migration changed since dry run');
   await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',
     [version,filename.slice(15,-4),[sql]]);
 }
 await db.query(apply?'COMMIT':'ROLLBACK');
 const result={status:apply?'applied':'dry_run_passed',project:communityProject,sha256,before,permissions,state};
 await writeFile(`artifacts/program-community/${apply?'applied':'dry-run'}${artifactSuffix}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){await db.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({status:'failed',code:error.code,message:error.message,position:error.position,where:error.where}));process.exitCode=1;}
finally{await db.end();}
