import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectCommunityDb, communityProject } from './community-db.mjs';
const apply = process.argv.includes('--apply');
const version = '20261019030000';
const directory = 'artifacts/repeat-mission-posts';
const baseline = JSON.parse(await readFile(`${directory}/schema.json`, 'utf8'));
const sql = (await readFile(`supabase/migrations/${version}_allow_repeat_mission_posts.sql`, 'utf8')).replace(/^BEGIN;|^COMMIT;/gm, '');
const sha256 = createHash('sha256').update(sql).digest('hex');
const names = ['prepare_online_challenge_submission','update_online_challenge_post',
    'admin_set_online_post_mission','settle_challenge_rewards_on_close','sync_challenge_missions'];
await mkdir(directory, { recursive: true });
const db = await connectCommunityDb();
try {
    await db.query('BEGIN'); await db.query('SET LOCAL ROLE postgres');
    await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    assert.equal((await db.query('SELECT count(*)::int n FROM supabase_migrations.schema_migrations WHERE version=$1',[version])).rows[0].n,0,'already applied');
    const current = (await db.query(`SELECT p.proname AS name,pg_get_functiondef(p.oid) AS definition
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY($1::text[])`,[names])).rows;
    assert.equal(current.length,names.length);
    for(const f of current) assert.equal(f.definition.replaceAll('\r\n','\n'),baseline.functions.find(b=>b.name===f.name)?.definition.replaceAll('\r\n','\n'),`function changed since review: ${f.name}`);
    const counts = async () => (await db.query(`SELECT
      (SELECT count(*) FROM public.users) AS profiles,(SELECT count(*) FROM public.logs) AS logs,
      (SELECT count(*) FROM public.community_channel_posts) AS posts,
      (SELECT count(*) FROM public.online_challenge_submissions) AS submissions,
      (SELECT count(*) FROM public.online_challenge_missions) AS missions,
      (SELECT count(*) FROM public.challenge_completion_rewards) AS rewards,
      (SELECT count(*) FROM public.haifn_transactions) AS transactions`)).rows[0];
    const before = await counts();
    const permissions = async () => (await db.query(`SELECT
      has_function_privilege('authenticated','public.update_online_challenge_post(uuid,uuid,text,uuid)','EXECUTE') AS author_edits,
      has_function_privilege('anon','public.update_online_challenge_post(uuid,uuid,text,uuid)','EXECUTE') AS anon_rpc`)).rows[0];
    const permissionsBefore = await permissions();
    if(apply) assert.equal(JSON.parse(await readFile(`${directory}/dry-run.json`,'utf8')).sha256,sha256);
    await db.query(sql);
    assert.deepEqual(await counts(),before,'existing records changed');
    const updated = (await db.query(`SELECT p.proname AS name,pg_get_functiondef(p.oid) AS definition
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY($1::text[])`,[names])).rows;
    assert.ok(updated.find(f=>f.name==='settle_challenge_rewards_on_close').definition.includes('count(DISTINCT s.completion_date)'));
    assert.ok(!updated.find(f=>f.name==='prepare_online_challenge_submission').definition.includes('v_count >= v_mission.target_count'));
    const policies = await permissions();
    assert.deepEqual(policies,permissionsBefore,'function permissions must not change');
    assert.ok(policies.author_edits);
    await writeFile(`${directory}/functions-before.json`,JSON.stringify(current,null,2));
    // Existing repeated daily posts must keep distinct-day reward counting even
    // if writing limits are restored. Preserve every post and transaction.
    await writeFile(`${directory}/restore-writing-limits.sql`,
      '-- Restore prior posting/editing limits. Retain safe distinct-day reward counting and all records.\nBEGIN;\n'
      +current.filter(f=>f.name!=='settle_challenge_rewards_on_close').map(f=>f.definition+';').join('\n')+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n");
    if(apply) await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',
      [version,'allow_repeat_mission_posts',[sql]]);
    await db.query(apply?'COMMIT':'ROLLBACK');
    const result={status:apply?'applied':'dry_run_passed',project:communityProject,sha256,before,existingRecordsChanged:0,permissions:policies};
    await writeFile(`${directory}/${apply?'applied':'dry-run'}.json`,JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
} catch(error) { await db.query('ROLLBACK').catch(()=>{}); throw error; }
finally { await db.end(); }
