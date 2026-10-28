import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectCommunityDb, communityProject } from './community-db.mjs';
const directory = 'artifacts/program-action-timing';
const baseline = JSON.parse(await readFile(`${directory}/baseline.json`, 'utf8'));
const version = '20261023010000';
const sql = (await readFile(`supabase/migrations/${version}_program_participant_action_timing.sql`, 'utf8')).replace(/^BEGIN;|^COMMIT;/gm, '');
const hash = createHash('sha256').update(sql).digest('hex');
const apply = process.argv.includes('--apply');
const db = await connectCommunityDb();
try {
    await db.query('BEGIN');
    await db.query("SET LOCAL ROLE postgres; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    const current = (await db.query(`SELECT proname,pg_get_functiondef(oid) definition,proacl::text permissions FROM pg_proc
        WHERE pronamespace='public'::regnamespace AND proname=ANY($1::text[])`, [baseline.map(f => f.proname)])).rows;
    assert.equal(current.length, 2);
    for (const f of current) assert.equal(f.definition, baseline.find(b => b.proname === f.proname)?.definition, 'Live function changed since review');
    const counts = async () => (await db.query(`SELECT (SELECT count(*) FROM public.notices) notices,
        (SELECT count(*) FROM public.notice_responses) responses,(SELECT count(*) FROM public.survey_links) links,
        (SELECT count(*) FROM public.survey_entries) entries,(SELECT count(*) FROM public.logs) logs`)).rows[0];
    const before = await counts();
    if (apply) assert.equal(JSON.parse(await readFile(`${directory}/dry-run.json`, 'utf8')).hash, hash);
    await db.query(sql);
    const updated = (await db.query(`SELECT proname,pg_get_functiondef(oid) definition,proacl::text permissions FROM pg_proc
        WHERE pronamespace='public'::regnamespace AND proname=ANY($1::text[])`, [baseline.map(f => f.proname)])).rows;
    assert.ok(updated.find(f => f.proname === 'guard_survey_entry').definition.includes('Survey opens after the program starts'));
    assert.ok(updated.find(f => f.proname === 'program_application_transition').definition.includes("p_action = 'CANCEL' AND v_program.is_challenge IS DISTINCT FROM true"));
    for (const f of updated) assert.equal(f.permissions, current.find(b => b.proname === f.proname).permissions);
    assert.deepEqual(await counts(), before, 'Existing row counts changed');
    // Exercise the actual transition against isolated temporary copies. No
    // production responses, triggers, sequences or notifications are written.
    await db.query(`CREATE TEMP TABLE timing_notices (LIKE public.notices INCLUDING DEFAULTS);
        CREATE TEMP TABLE timing_responses (LIKE public.notice_responses INCLUDING DEFAULTS);
        INSERT INTO timing_notices SELECT n.* FROM public.notices n WHERE EXISTS
            (SELECT 1 FROM public.notice_responses r WHERE r.notice_id=n.id AND r.status='JOIN') LIMIT 1;
        INSERT INTO timing_responses SELECT r.* FROM public.notice_responses r JOIN timing_notices n ON n.id=r.notice_id WHERE r.status='JOIN' LIMIT 1;
        UPDATE timing_notices SET category='PROGRAM',is_recruiting=true,is_challenge=false,is_leader_only=false,
            program_status='ACTIVE',guest_properties='{}',recruitment_start_at=NULL,
            recruitment_deadline=now()-interval '1 hour',program_date=now()+interval '1 hour',max_capacity=0;`);
    const fixture = (await db.query('SELECT notice_id,user_id FROM timing_responses LIMIT 1')).rows[0];
    assert.ok(fixture, 'A temporary participation fixture is required');
    const testDefinition = updated.find(f => f.proname === 'program_application_transition').definition
        .replace('public.program_application_transition(', 'pg_temp.timing_transition(')
        .replaceAll('public.notices', 'pg_temp.timing_notices')
        .replaceAll('public.notice_responses', 'pg_temp.timing_responses');
    await db.query(testDefinition);
    const transition = action => db.query('SELECT pg_temp.timing_transition($1,$2,$3,$4,$5) result', [fixture.notice_id, fixture.user_id, action, 'MEMBER', {}]);
    assert.equal((await transition('CANCEL')).rows[0].result.status, 'CANCELLED', 'Cancellation after recruitment closes must succeed');
    const rejects = async (action, message) => {
        await db.query('SAVEPOINT timing_case');
        let error;
        try { await transition(action); } catch (caught) { error = caught; }
        await db.query('ROLLBACK TO SAVEPOINT timing_case');
        assert.ok(error?.message.includes(message), `Expected ${action} rejection: ${message}`);
    };
    await rejects('JOIN', '신청 및 취소 기간이 종료');
    await db.query("UPDATE timing_notices SET program_date=now()");
    await rejects('CANCEL', '신청 및 취소 기간이 종료');
    await db.query("UPDATE timing_notices SET program_date=now()+interval '1 hour',is_challenge=true");
    await rejects('CANCEL', '신청 및 취소 기간이 종료');
    await writeFile(`${directory}/rollback.sql`, 'BEGIN;\n' + baseline.map(f => f.definition + ';').join('\n') + "\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n");
    if (apply) await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)', [version, 'program_participant_action_timing', [sql]]);
    await db.query(apply ? 'COMMIT' : 'ROLLBACK');
    const result = { status: apply ? 'applied' : 'dry_run_passed', project: communityProject, hash, existingRowsChanged: 0, transitionCasesPassed: 4, counts: before };
    await writeFile(`${directory}/${apply ? 'applied' : 'dry-run'}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
} catch (error) { await db.query('ROLLBACK').catch(() => {}); throw error; }
finally { await db.end(); }
