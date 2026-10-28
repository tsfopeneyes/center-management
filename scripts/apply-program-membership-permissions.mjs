import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectCommunityDb, communityProject } from './community-db.mjs';

const version = '20261019010000';
const apply = process.argv.includes('--apply');
const sql = (await readFile(`supabase/migrations/${version}_program_community_application_membership.sql`, 'utf8')).replace(/^BEGIN;|^COMMIT;/gm, '');
const sha256 = createHash('sha256').update(sql).digest('hex');
const directory = 'artifacts/program-community';
const db = await connectCommunityDb({ cliPath: process.env.COMMUNITY_SUPABASE_CLI });
const counts = async () => (await db.query(`SELECT
 (SELECT count(*) FROM notices) AS programs,(SELECT count(*) FROM notice_responses) AS applications,
 (SELECT count(*) FROM community_channel_members) AS members,(SELECT count(*) FROM community_channel_posts) AS posts,
 (SELECT count(*) FROM community_channel_comments) AS comments,(SELECT count(*) FROM online_challenge_submissions) AS submissions,
 (SELECT count(*) FROM logs) AS logs`)).rows[0];
try {
 await db.query('BEGIN');
 await db.query('SET LOCAL ROLE postgres');
 await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
 assert.equal((await db.query('SELECT count(*)::int AS n FROM supabase_migrations.schema_migrations WHERE version=$1', [version])).rows[0].n, 0, 'already applied');
 const before = await counts();
 const previous = (await db.query("SELECT pg_get_functiondef('community_security.member_ids(uuid)'::regprocedure) AS definition")).rows[0].definition;
 const impact = (await db.query(`SELECT c.id,c.name,count(*)::int AS ignored_direct_members FROM community_channel_members m
 JOIN community_channels c ON c.id=m.channel_id WHERE c.source_notice_id IS NOT NULL AND m.revoked_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM community_security.member_ids(c.id) x WHERE x.user_id=m.user_id AND x.source='PROGRAM')
 GROUP BY c.id,c.name`)).rows;
 await mkdir(directory, { recursive: true });
 if (!apply) await writeFile(`${directory}/restore-${version}.sql`, `BEGIN;\nDROP TRIGGER IF EXISTS guard_linked_direct_member ON public.community_channel_members;\n${previous};\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n`);
 await db.query(sql);
 assert.deepEqual(await counts(), before, 'protected record counts changed');
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM community_channels c CROSS JOIN LATERAL community_security.member_ids(c.id) m
 WHERE c.source_notice_id IS NOT NULL AND m.source='DIRECT'`)).rows[0].n, 0);
 const missionGuard = (await db.query("SELECT pg_get_functiondef('public.prepare_online_challenge_submission()'::regprocedure) AS definition")).rows[0].definition;
 assert.match(missionGuard, /nr\.status\s*=\s*'JOIN'/, 'mission application check must remain');
 const access = (await db.query("SELECT pg_get_functiondef('public.can_access_community_channel(uuid,uuid)'::regprocedure) AS definition")).rows[0].definition;
 assert.match(access, /is_current_staff/, 'staff access must remain');
 if (apply) {
   const dry = JSON.parse(await readFile(`${directory}/dry-run-${version}.json`, 'utf8'));
   assert.equal(dry.sha256, sha256, 'migration changed after dry run');
   await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)', [version, 'program_community_application_membership', [sql]]);
 }
 await db.query(apply ? 'COMMIT' : 'ROLLBACK');
 const result = { status: apply ? 'applied' : 'dry_run_passed', project: communityProject, sha256, before, impact, staffAccessPreserved: true, missionApplicationRequired: true };
 await writeFile(`${directory}/${apply ? 'applied' : 'dry-run'}-${version}.json`, JSON.stringify(result, null, 2));
 console.log(JSON.stringify(result));
} catch (error) {
 await db.query('ROLLBACK').catch(() => {});
 console.error(JSON.stringify({ status: 'failed', code: error.code, message: error.message }));
 process.exitCode = 1;
} finally { await db.end(); }
