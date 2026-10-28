import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectCommunityDb,communityProject } from './community-db.mjs';

// A single reviewed CHECK constraint migration; no individual member data is read.
const apply=process.argv.includes('--apply');
const version='20261014040000';
const sql=(await readFile(`supabase/migrations/${version}_general_program_community_constraint.sql`,'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');
const sha256=createHash('sha256').update(sql).digest('hex');
const db=await connectCommunityDb();
const counts=async()=> (await db.query(`SELECT (SELECT count(*) FROM notices) AS notices,
    (SELECT count(*) FROM notice_responses) AS applications,(SELECT count(*) FROM community_channels) AS channels,
    (SELECT count(*) FROM community_channel_posts) AS posts,(SELECT count(*) FROM logs) AS logs`)).rows[0];
try {
    await db.query('BEGIN');
    // The linked maintenance login needs its configured postgres role for schema migrations.
    await db.query('SET LOCAL ROLE postgres');
    await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    assert.equal((await db.query('SELECT count(*)::int AS count FROM supabase_migrations.schema_migrations WHERE version=$1',[version])).rows[0].count,0,'already applied');
    const previous=(await db.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid='public.notices'::regclass AND conname='notices_online_community_only'`)).rows[0];
    assert.ok(previous,'expected legacy constraint missing');
    assert.ok(previous.definition.includes('challenge_format')&&previous.definition.includes('ONLINE'),'unexpected legacy check');
    const incompatible=(await db.query("SELECT count(*)::int AS count FROM notices WHERE community_enabled AND category IS DISTINCT FROM 'PROGRAM'")).rows[0].count;
    assert.equal(incompatible,0,'existing rows incompatible with program-only check');
    const before=await counts();
    await writeFile(`artifacts/program-community/restore-constraint-${version}.sql`,
        `-- Restore the previous check without changing any records. NOT VALID preserves new general-program rows.\nBEGIN;\nALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_program_community_only;\nALTER TABLE public.notices ADD CONSTRAINT ${previous.conname} ${previous.definition.replace(/ NOT VALID$/,'')} NOT VALID;\nCOMMIT;\n`);
    await db.query(sql);
    assert.deepEqual(await counts(),before,'record counts changed');
    const current=(await db.query(`SELECT conname,convalidated,pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid='public.notices'::regclass AND conname='notices_program_community_only'`)).rows[0];
    assert.equal(current.convalidated,true);
    if(apply){
        const dry=JSON.parse(await readFile(`artifacts/program-community/dry-run-${version}.json`,'utf8'));
        assert.equal(dry.sha256,sha256,'migration changed after dry run');
        await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,'general_program_community_constraint',[sql]]);
    }
    await db.query(apply?'COMMIT':'ROLLBACK');
    const result={status:apply?'applied':'dry_run_passed',project:communityProject,sha256,before,incompatible,previous,current};
    await writeFile(`artifacts/program-community/${apply?'applied':'dry-run'}-${version}.json`,JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
}catch(error){
    await db.query('ROLLBACK').catch(()=>{});
    console.error(JSON.stringify({status:'failed',code:error.code,message:error.message}));process.exitCode=1;
}finally{await db.end();}
