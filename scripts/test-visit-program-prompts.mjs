import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const table = 'public.visit_program_prompts';
const haifn = "('HAIFN', '24일 챌린지', '작은 미션에 참여해 보세요.', 'https://app.schoolchurchimpact.org/p/175', 'BOTH', true)";
const enough = "('ENOUGH_PLACE', '센터 프로그램', '', 'https://example.com/program', 'CHECKOUT', false)";
const migration = await readFile(new URL('../supabase/migrations/20261124040000_visit_program_prompts.sql', import.meta.url), 'utf8');
const applicantMigration = await readFile(new URL('../supabase/migrations/20261124050000_visit_program_prompt_applicants.sql', import.meta.url), 'utf8');
const rows = async sql => (await db.query(sql)).rows;
const denied = sql => assert.rejects(db.exec(sql), { code: '42501' });

try {
    await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role BYPASSRLS;
        CREATE TABLE public.notices (id bigint PRIMARY KEY);
        INSERT INTO public.notices VALUES (175);
        CREATE FUNCTION public.is_current_staff() RETURNS boolean STABLE LANGUAGE sql
        AS $$ SELECT coalesce(current_setting('test.staff', true) = 'yes', false) $$;
    `);
    await db.exec(migration);
    assert.deepEqual(await rows(`SELECT relrowsecurity FROM pg_class WHERE oid = '${table}'::regclass`), [{ relrowsecurity: true }]);
    await db.exec("SET ROLE authenticated; SET test.staff = 'yes';");
    await db.exec(`INSERT INTO ${table} VALUES ${haifn}, ${enough}`);
    await db.exec(`INSERT INTO ${table} VALUES ${enough}
        ON CONFLICT (center_code) DO UPDATE SET description = '수정됨'`);
    assert.deepEqual(await rows(`SELECT description FROM ${table} WHERE center_code = 'ENOUGH_PLACE'`), [{ description: '수정됨' }]);
    assert.equal((await rows(`SELECT center_code FROM ${table}`)).length, 2);
    await assert.rejects(db.exec(`UPDATE ${table} SET url = 'javascript:alert(1)'`), { code: '23514' });
    await assert.rejects(db.exec(`UPDATE ${table} SET url = 'https://a@example.com'`), { code: '23514' });
    await assert.rejects(db.exec(`UPDATE ${table} SET show_at = 'UNSUPPORTED'`), { code: '23514' });
    await denied(`DELETE FROM ${table}`);

    await db.exec("SET test.staff = 'no';");
    assert.deepEqual(await rows(`SELECT center_code FROM ${table}`), [{ center_code: 'HAIFN' }]);
    await denied(`INSERT INTO ${table} VALUES ${haifn} ON CONFLICT (center_code) DO NOTHING`);
    assert.deepEqual(await rows(`UPDATE ${table} SET title = '권한 없는 수정' RETURNING title`), []);

    await db.exec('SET ROLE anon');
    assert.deepEqual(await rows(`SELECT center_code FROM ${table} WHERE show_at IN ('CHECKIN', 'BOTH')`), [{ center_code: 'HAIFN' }]);
    assert.deepEqual(await rows(`SELECT center_code FROM ${table} WHERE center_code = 'ENOUGH_PLACE'`), []);
    await denied(`INSERT INTO ${table} VALUES ${enough}`);
    await denied(`UPDATE ${table} SET enabled = false`);

    await db.exec('RESET ROLE');
    await db.exec(applicantMigration);
    assert.deepEqual(await rows(`SELECT show_to_applicants, program_id FROM ${table} ORDER BY center_code`), [
        { show_to_applicants: true, program_id: null },
        { show_to_applicants: true, program_id: null }
    ]);
    await db.exec("SET ROLE authenticated; SET test.staff = 'yes';");
    await db.exec(`UPDATE ${table} SET show_to_applicants = false, program_id = 175 WHERE center_code = 'HAIFN'`);
    await assert.rejects(db.exec(`UPDATE ${table} SET program_id = 999`), { code: '23503' });
    await db.exec("SET test.staff = 'no';");
    assert.deepEqual(await rows(`UPDATE ${table} SET show_to_applicants = true RETURNING center_code`), []);
    await db.exec('SET ROLE anon');
    assert.deepEqual(await rows(`SELECT show_to_applicants, program_id FROM ${table}`), [{ show_to_applicants: false, program_id: 175 }]);
    await denied(`UPDATE ${table} SET show_to_applicants = true`);
    await db.exec('RESET ROLE; DELETE FROM public.notices WHERE id = 175;');
    assert.deepEqual(await rows(`SELECT show_to_applicants, program_id FROM ${table} WHERE center_code = 'HAIFN'`),
        [{ show_to_applicants: false, program_id: null }]);

    await db.exec('SET ROLE service_role');
    await denied(`SELECT * FROM ${table}`);
    console.log('Visit program prompts: grants, RLS, staff upsert, public visibility and database validation passed.');
} finally {
    await db.close();
}

const promptCode = (await readFile(new URL('../src/utils/visitProgramPrompts.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace("const table =", "const { supabase, resolveSurveyCenterCode } = globalThis.visitPromptTest;\nconst table =");
const calls = [];
let resultByTable;
globalThis.visitPromptTest = {
    resolveSurveyCenterCode: () => 'HAIFN',
    supabase: {
        from(name) {
            const query = { name, filters: [] };
            calls.push(query);
            for (const method of ['select', 'eq', 'in', 'gte', 'limit', 'abortSignal']) {
                query[method] = (...args) => { query.filters.push([method, ...args]); return query; };
            }
            query.maybeSingle = async () => resultByTable[name];
            query.then = resolve => resolve(resultByTable[name]);
            return query;
        }
    }
};
try {
    const { loadVisitProgramPrompt, programIdFromPublicLink, saveVisitProgramPrompt } = await import(
        'data:text/javascript;base64,' + Buffer.from(promptCode).toString('base64')
    );
    const prompt = { program_id: 175, show_to_applicants: false, url: 'https://app.schoolchurchimpact.org/p/175' };
    const visit = { event: 'CHECKOUT', locationName: '하이픈', userId: 'member', verifiedProfileId: 'member' };
    const result = data => ({ data, error: null });
    resultByTable = {
        visit_program_prompts: result(prompt),
        notice_responses: result([]),
        daily_program_session_responses: result([])
    };
    assert.ok(await loadVisitProgramPrompt(visit));
    assert.ok(calls.find(call => call.name === 'notice_responses').filters.some(filter =>
        filter[0] === 'in' && filter[1] === 'status' && filter[2].join(',') === 'JOIN,WAITLIST'));
    assert.ok(calls.find(call => call.name === 'daily_program_session_responses').filters.some(filter =>
        filter[0] === 'gte' && filter[1] === 'daily_program_sessions.session_date' && /^\d{4}-\d{2}-\d{2}$/.test(filter[2])));

    resultByTable.notice_responses = result([{ notice_id: 175 }]);
    assert.equal(await loadVisitProgramPrompt(visit), null);
    resultByTable.notice_responses = result([]);
    resultByTable.daily_program_session_responses = result([{ session_id: 'upcoming' }]);
    assert.equal(await loadVisitProgramPrompt(visit), null);

    calls.length = 0;
    assert.equal(await loadVisitProgramPrompt({ ...visit, verifiedProfileId: 'other' }), null);
    assert.deepEqual(calls.map(call => call.name), ['visit_program_prompts']);
    resultByTable.visit_program_prompts = result({ ...prompt, program_id: null });
    assert.equal(await loadVisitProgramPrompt(visit), null);

    resultByTable.visit_program_prompts = result(prompt);
    const lookupError = new Error('Unavailable');
    resultByTable.daily_program_session_responses = { data: null, error: lookupError };
    await assert.rejects(loadVisitProgramPrompt(visit), lookupError);

    calls.length = 0;
    resultByTable.visit_program_prompts = result({ ...prompt, show_to_applicants: true });
    assert.ok(await loadVisitProgramPrompt({ ...visit, verifiedProfileId: null }));
    assert.deepEqual(calls.map(call => call.name), ['visit_program_prompts']);

    assert.equal(programIdFromPublicLink(prompt.url), '175');
    assert.equal(programIdFromPublicLink('https://example.com/p/175'), null);
    await assert.rejects(saveVisitProgramPrompt({ ...prompt, enabled: true, program_id: 99 }), /일치시켜/);
    console.log('Applicant visibility: general and session applications, guest exclusion, read failures and direct URL validation passed.');
} finally {
    delete globalThis.visitPromptTest;
}
