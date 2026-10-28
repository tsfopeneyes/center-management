import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { connectCommunityDb, communityProject } from './community-db.mjs';

const migration = await readFile('supabase/migrations/20261028010000_unify_challenge_success_criterion.sql','utf8');
const original = await readFile('supabase/migrations/20261019030000_allow_repeat_mission_posts.sql','utf8');
const previous = original.slice(original.indexOf('CREATE OR REPLACE FUNCTION public.settle_challenge_rewards_on_close()'),original.indexOf('CREATE OR REPLACE FUNCTION public.sync_challenge_missions'));
const body = sql => sql.match(/AS \$function\$([\s\S]*?)\$function\$/)[1].replace(/\r\n/g,'\n').trim();
const db = await connectCommunityDb();
const folder = 'artifacts/challenge-success-criterion';
try {
    await db.query('BEGIN READ ONLY');
    await db.query('SET LOCAL ROLE postgres');
    const {rows:[fn]} = await db.query("SELECT pg_get_functiondef('public.settle_challenge_rewards_on_close()'::regprocedure) AS definition, prosrc FROM pg_proc WHERE oid='public.settle_challenge_rewards_on_close()'::regprocedure");
    const liveBody=fn.prosrc.replace(/\r\n/g,'\n').trim();
    assert.ok(liveBody === body(previous) || liveBody === body(migration),'Live function differs from reviewed version; inspect before applying');
    const snapshot = async () => (await db.query(`SELECT
      (SELECT count(*)::int FROM notices) AS notices,
      (SELECT count(*)::int FROM online_challenge_submissions) AS online_submissions,
      (SELECT count(*)::int FROM offline_challenge_submissions) AS offline_submissions,
      (SELECT count(*)::int FROM challenge_completion_rewards) AS rewards,
      (SELECT count(*)::int FROM haifn_transactions) AS transactions`)).rows[0];
    const before = await snapshot();
    await db.query('ROLLBACK');
    await mkdir(folder,{recursive:true});
    if(liveBody === body(migration)) { console.log('Already applied; no changes needed.'); }
    else {
        await writeFile(`${folder}/restore-settlement.sql`,fn.definition);
        await writeFile(`${folder}/impact.json`,JSON.stringify({project:communityProject,before,scope:'Replace settlement function only; no record updates'},null,2));
        if(!process.argv.includes('--apply')) { console.log('PASS read-only impact check; recovery saved. No database changes.'); }
        else {
            await db.query('BEGIN');
            await db.query('SET LOCAL ROLE postgres');
            await db.query(migration);
            const after = await snapshot();
            assert.deepEqual(after,before,'Dry run must not modify records');
            await db.query('ROLLBACK');
            await db.query('BEGIN');
            await db.query('SET LOCAL ROLE postgres');
            await db.query(migration);
            const {rows:[check]}=await db.query("SELECT prosrc FROM pg_proc WHERE oid='public.settle_challenge_rewards_on_close()'::regprocedure");
            assert.equal(check.prosrc.replace(/\r\n/g,'\n').trim(),body(migration));
            await db.query('COMMIT');
            console.log('PASS applied reviewed function replacement after rollback dry run. Existing settings, submissions and reward records preserved.');
        }
    }
} catch(error) { await db.query('ROLLBACK').catch(()=>{}); throw error; }
finally { await db.end(); }
