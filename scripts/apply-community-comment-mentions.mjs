import {connectCommunityDb,communityProject} from './community-db.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const mode=process.argv[2]||'dry';if(!['dry','schema','queue'].includes(mode))throw Error('Invalid mode');
const sql=await readFile('supabase/migrations/20261023050000_community_comment_mentions.sql','utf8');
const split=sql.indexOf('CREATE OR REPLACE FUNCTION public.queue_community_comment_push()');
const db=await connectCommunityDb();
try{await db.query('BEGIN');await db.query('SET LOCAL ROLE postgres');await db.query("SET LOCAL lock_timeout='5s'");
const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM community_channel_comments)::int AS comments,(SELECT count(*) FROM community_comment_push_recipients)::int AS recipients,(SELECT count(*) FROM community_post_push_digests)::int AS digests')).rows[0];
const before=await counts();
if(mode==='dry'){
 const previous=(await db.query("SELECT pg_get_functiondef('public.queue_community_comment_push()'::regprocedure) AS sql")).rows[0].sql;
 await mkdir('artifacts/community-comment-mentions',{recursive:true});
 await writeFile('artifacts/community-comment-mentions/rollback.sql',previous+';\nDROP TRIGGER IF EXISTS validate_comment_mentions ON public.community_channel_comments;\nDROP FUNCTION IF EXISTS community_security.validate_comment_mentions();\nDROP FUNCTION IF EXISTS community_security.contains_mention(text,text);\n-- Keep the additive mentioned_user_ids column so selected IDs remain recoverable.\n');
}
await db.query(mode==='schema'?sql.slice(0,split):mode==='queue'?sql.slice(split):sql);
assert.deepEqual(await counts(),before);
const permissions=(await db.query("SELECT has_function_privilege('anon','community_security.contains_mention(text,text)','EXECUTE') AS anon_helper,has_function_privilege('authenticated','community_security.validate_comment_mentions()','EXECUTE') AS authenticated_helper")).rows[0];assert.equal(permissions.anon_helper,false);assert.equal(permissions.authenticated_helper,false);
await db.query(mode==='dry'?'ROLLBACK':'COMMIT');console.log(JSON.stringify({project:communityProject,mode,before,existingRowsUnchanged:true,permissions}));
}catch(error){await db.query('ROLLBACK');throw error}finally{await db.end()}
