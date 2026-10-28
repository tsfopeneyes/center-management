import {connectCommunityDb,communityProject} from './community-db.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const apply=process.argv.includes('--apply');
const sql=await readFile('supabase/migrations/20261023040000_challenge_host_push_recipients.sql','utf8');
const db=await connectCommunityDb();
try{
 await db.query('BEGIN');await db.query('SET LOCAL ROLE postgres');await db.query("SET LOCAL lock_timeout='5s'");
 const baseline=(await db.query("SELECT pg_get_functiondef('public.queue_community_post_push()'::regprocedure) AS sql")).rows[0].sql;
 assert.ok(baseline.includes('community_security.member_ids'), 'Expected original recipient function');
 await mkdir('artifacts/challenge-host-push',{recursive:true});
 await writeFile('artifacts/challenge-host-push/rollback.sql',baseline+';\nDROP FUNCTION IF EXISTS community_security.push_recipient_ids(uuid);\n');
 const counts=async()=> (await db.query('SELECT (SELECT count(*) FROM community_post_push_recipients)::int AS recipients,(SELECT count(*) FROM community_post_push_digests)::int AS digests,(SELECT count(*) FROM community_channel_posts)::int AS posts')).rows[0];
 const before=await counts();await db.query(sql);
 const impact=(await db.query(`SELECT count(*)::int AS challenge_channels,coalesce(sum((SELECT count(*) FROM community_security.push_recipient_ids(c.id))),0)::int AS total_unique_recipients FROM community_channels c JOIN notices n ON n.id=c.source_notice_id WHERE n.is_challenge IS TRUE AND c.status='ACTIVE'`)).rows[0];
 assert.deepEqual(await counts(),before);
 await db.query(apply?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({project:communityProject,mode:apply?'APPLIED':'DRY_RUN_ROLLED_BACK',before,impact,existingRecordsUnchanged:true}));
} catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
