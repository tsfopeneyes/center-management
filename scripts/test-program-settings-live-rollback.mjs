import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (process.argv.length !== 2) throw new Error('This test always rolls back');
const projectRef = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (projectRef !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked Supabase project');
let cliOutput;
try {
    cliOutput = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
} catch {
    throw new Error('Unable to obtain linked database connection settings');
}
const credential = name => cliOutput.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !credential(name))) {
    throw new Error('Linked database credentials are unavailable');
}
const db = new pg.Client({
    host: credential('PGHOST'), port: Number(credential('PGPORT')),
    user: credential('PGUSER'), password: credential('PGPASSWORD'),
    database: credential('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: 'program-settings-live-rollback-test',
});
let transactionOpen = false;
const countsSql = `SELECT
    (SELECT count(*)::integer FROM public.notices) AS notices,
    (SELECT count(*)::integer FROM public.notice_responses) AS whole_responses,
    (SELECT count(*)::integer FROM public.daily_program_sessions) AS sessions,
    (SELECT count(*)::integer FROM public.daily_program_session_responses) AS session_responses,
    (SELECT count(*)::integer FROM public.users) AS users,
    (SELECT count(*)::integer FROM public.survey_forms) AS survey_forms,
    (SELECT count(*)::integer FROM public.survey_versions) AS survey_versions,
    (SELECT count(*)::integer FROM public.survey_links) AS survey_links,
    (SELECT count(*)::integer FROM public.offline_challenge_missions) AS offline_missions,
    (SELECT count(*)::integer FROM public.program_push_jobs) AS push_jobs,
    (SELECT count(*)::integer FROM public.app_notifications) AS notifications`;
try {
    await db.connect();
    await db.query('BEGIN');
    transactionOpen = true;
    await db.query("SET LOCAL statement_timeout = '20s'");
    await db.query("SET LOCAL lock_timeout = '3s'");
    const identity = await db.query(`SELECT current_user AS role_name,
        pg_has_role(current_user, 'postgres', 'MEMBER') AS is_owner_member`);
    if (identity.rows[0]?.role_name !== 'cli_login_postgres' || identity.rows[0]?.is_owner_member !== true) {
        throw new Error('Unexpected linked role; refusing live test');
    }
    await db.query('SET LOCAL ROLE postgres');
    const beforeCounts = (await db.query(countsSql)).rows[0];
    const account = await db.query(`SELECT a.auth_user_id FROM account_security.accounts a
        JOIN account_security.account_roles r USING (profile_id)
        JOIN public.users u ON u.id=a.profile_id
        WHERE a.auth_user_id IS NOT NULL AND a.mapping_verified IS TRUE
          AND a.status='active' AND r.enabled IS TRUE
          AND r.role IN ('admin','master') AND u.status IS DISTINCT FROM 'withdrawn'
        LIMIT 1`);
    if (account.rowCount !== 1) throw new Error('No verified testable staff identity');
    const notice = await db.query(`SELECT id,title,application_form,application_form_revision,guest_properties
        FROM public.notices WHERE category='PROGRAM' ORDER BY id LIMIT 1 FOR UPDATE`);
    if (notice.rowCount !== 1 || notice.rows[0].application_form == null) {
        throw new Error('No canonical program available');
    }
    const row = notice.rows[0];
    const unchangedPayload = JSON.stringify({
        category: 'PROGRAM', title: row.title,
        application_form: row.application_form, guest_properties: row.guest_properties,
    });
    await db.query('SET LOCAL ROLE authenticated');
    const claims = JSON.stringify({ sub: account.rows[0].auth_user_id, role: 'authenticated' });
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [claims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [account.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    const staff = await db.query('SELECT public.is_current_staff() AS permitted');
    if (staff.rows[0]?.permitted !== true) throw new Error('Staff claim simulation was not accepted');

    const saved = await db.query(`SELECT public.save_program_settings_atomic(
        $1,$2::jsonb,$3,NULL,NULL) AS result`, [row.id, unchangedPayload, row.application_form_revision]);
    assert.equal(Number(saved.rows[0].result.id), Number(row.id));
    assert.equal(saved.rows[0].result.application_form_revision, row.application_form_revision);

    await db.query('SAVEPOINT stale_revision');
    let staleRejected = false;
    try {
        await db.query(`SELECT public.save_program_settings_atomic(
            $1,$2::jsonb,$3,NULL,NULL)`, [row.id, unchangedPayload, row.application_form_revision - 1]);
    } catch (error) {
        staleRejected = error.code === '40001';
    }
    await db.query('ROLLBACK TO SAVEPOINT stale_revision');
    if (!staleRejected) throw new Error('Stale admin edit was not rejected');

    const fallback = await db.query(`INSERT INTO public.program_settings_save_requests
        (notice_id,notice,expected_form_revision)
        VALUES($1,$2::jsonb,$3) RETURNING saved_notice_id,application_form_revision`,
    [row.id, unchangedPayload, row.application_form_revision]);
    assert.equal(Number(fallback.rows[0].saved_notice_id), Number(row.id));
    assert.equal(fallback.rows[0].application_form_revision, row.application_form_revision);

    const syntheticNotice = JSON.stringify({
        title: '검증용 프로그램 (자동 롤백)',
        short_description: '운영 신청 경계 확인', content: '저장되지 않는 검증용 프로그램',
        category: 'PROGRAM', is_recruiting: true, is_challenge: false,
        is_private: false, program_type: 'CENTER', program_status: 'ACTIVE',
        program_date: new Date(Date.now() + 172_800_000).toISOString(),
        recruitment_deadline: new Date(Date.now() + 86_400_000).toISOString(),
        max_capacity: 2, application_form: { questions: [] },
        guest_properties: { allow_guest: true, application_scope: 'PROGRAM',
            require_school: true, require_phone: true },
    });
    const synthetic = await db.query(`SELECT public.save_program_settings_atomic(
        NULL,$1::jsonb,NULL,NULL,NULL) AS result`, [syntheticNotice]);
    const program = { id: synthetic.rows[0].result.id,
        application_form_revision: synthetic.rows[0].result.application_form_revision };
    await db.query('SET LOCAL ROLE postgres');
    let phone;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `010${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
        const collision = await db.query(`SELECT 1 FROM public.users
            WHERE regexp_replace(coalesce(phone,''),'[^0-9]','','g')=$1 LIMIT 1`, [candidate]);
        if (collision.rowCount === 0) { phone = candidate; break; }
    }
    if (!phone) throw new Error('Unable to reserve a synthetic phone in the rollback transaction');
    await db.query('SET LOCAL ROLE anon');
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',true)");
    await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
    await db.query("SELECT set_config('request.jwt.claim.role','anon',true)");
    const guest = await db.query(`SELECT public.register_guest_program_application_checked(
        $1,NULL,$2::jsonb,'{}'::jsonb,$3) AS result`, [
        program.id, JSON.stringify({ name: '검증용 비회원', school: '검증용 학교',
            phone, birth_date: '2008-03-15', privacy_consent: true }),
        program.application_form_revision,
    ]);
    if (!['JOIN', 'WAITLIST'].includes(guest.rows[0].result.status)) {
        throw new Error('Guest application returned an unexpected status');
    }
    await db.query('SET LOCAL ROLE postgres');
    const storedGuest = await db.query(`SELECT r.application_form_revision,r.application_form_snapshot
        FROM public.notice_responses r WHERE r.notice_id=$1 AND r.user_id=$2`,
    [program.id, guest.rows[0].result.user_id]);
    assert.equal(storedGuest.rowCount, 1);
    assert.equal(storedGuest.rows[0].application_form_revision, program.application_form_revision);
    assert.ok(storedGuest.rows[0].application_form_snapshot);

    const member = await db.query(`SELECT u.id,a.auth_user_id
        FROM account_security.accounts a
        JOIN account_security.account_roles r USING(profile_id)
        JOIN public.users u ON u.id=a.profile_id
        WHERE a.auth_user_id IS NOT NULL AND a.mapping_verified IS TRUE
          AND a.status='active' AND r.enabled IS TRUE AND r.role='member'
          AND u.user_group IS DISTINCT FROM '게스트'
          AND u.user_group IS DISTINCT FROM 'STAFF'
          AND u.role IN ('student','user')
          AND u.status IS DISTINCT FROM 'withdrawn'
          AND (u.id=a.auth_user_id OR u.auth_user_id=a.auth_user_id)
        LIMIT 1`);
    if (member.rowCount !== 1) throw new Error('No verified testable member identity');
    await db.query('SET LOCAL ROLE authenticated');
    const memberClaims = JSON.stringify({ sub: member.rows[0].auth_user_id, role: 'authenticated' });
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [memberClaims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [member.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    const joined = await db.query(`SELECT public.respond_to_program_application_checked(
        $1,$2,'JOIN','{}'::jsonb,$3) AS result`,
    [program.id, member.rows[0].id, program.application_form_revision]);
    assert.equal(joined.rows[0].result.status, 'JOIN');
    await db.query('SET LOCAL ROLE postgres');
    const storedMember = await db.query(`SELECT application_form_revision,application_form_snapshot
        FROM public.notice_responses WHERE notice_id=$1 AND user_id=$2`,
    [program.id, member.rows[0].id]);
    assert.equal(storedMember.rowCount, 1);
    assert.equal(storedMember.rows[0].application_form_revision, program.application_form_revision);
    assert.ok(storedMember.rows[0].application_form_snapshot);

    let waitingPhone;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `010${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
        const collision = await db.query(`SELECT 1 FROM public.users
            WHERE regexp_replace(coalesce(phone,''),'[^0-9]','','g')=$1 LIMIT 1`, [candidate]);
        if (collision.rowCount === 0) { waitingPhone = candidate; break; }
    }
    if (!waitingPhone) throw new Error('Unable to reserve second synthetic phone');
    await db.query('SET LOCAL ROLE anon');
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',true)");
    await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
    await db.query("SELECT set_config('request.jwt.claim.role','anon',true)");
    const waiting = await db.query(`SELECT public.register_guest_program_application_checked(
        $1,NULL,$2::jsonb,'{}'::jsonb,$3) AS result`, [
        program.id, JSON.stringify({ name: '검증용 대기자', school: '검증용 학교',
            phone: waitingPhone, birth_date: '2008-03-15', privacy_consent: true }),
        program.application_form_revision,
    ]);
    assert.equal(waiting.rows[0].result.status, 'WAITLIST');
    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [memberClaims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [member.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    const cancelled = await db.query(`SELECT public.respond_to_program_application_checked(
        $1,$2,'CANCEL','{}'::jsonb,NULL) AS result`, [program.id, member.rows[0].id]);
    assert.equal(cancelled.rows[0].result.status, 'CANCELLED');
    await db.query('SET LOCAL ROLE postgres');
    const promoted = await db.query(`SELECT status FROM public.notice_responses
        WHERE notice_id=$1 AND user_id=$2`, [program.id, waiting.rows[0].result.user_id]);
    assert.equal(promoted.rows[0]?.status, 'JOIN');

    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [claims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [account.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    const challengeNotice = {
        ...JSON.parse(syntheticNotice), title: '검증용 챌린지 (자동 롤백)',
        is_challenge: true, challenge_format: 'OFFLINE',
        program_start_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
        program_end_date: new Date(Date.now() + 259_200_000).toISOString().slice(0, 10),
        guest_properties: { allow_guest: true, application_scope: 'NONE',
            require_school: true, require_phone: true },
    };
    const challenge = await db.query(`SELECT public.save_program_settings_atomic(
        NULL,$1::jsonb,NULL,NULL,$2::jsonb) AS result`, [JSON.stringify(challengeNotice),
        JSON.stringify([{ title: '검증용 미션', description: '', location: '센터',
            verification_type: 'PHOTO', sort_order: 0 }])]);
    await db.query('SET LOCAL ROLE postgres');
    const mission = await db.query(`SELECT 1 FROM public.offline_challenge_missions
        WHERE challenge_id=$1 AND is_active LIMIT 1`, [challenge.rows[0].result.id]);
    assert.equal(mission.rowCount, 1);
    let challengePhone;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `010${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
        const collision = await db.query(`SELECT 1 FROM public.users
            WHERE regexp_replace(coalesce(phone,''),'[^0-9]','','g')=$1 LIMIT 1`, [candidate]);
        if (collision.rowCount === 0) { challengePhone = candidate; break; }
    }
    if (!challengePhone) throw new Error('Unable to reserve challenge synthetic phone');
    await db.query('SET LOCAL ROLE anon');
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',true)");
    await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
    await db.query("SELECT set_config('request.jwt.claim.role','anon',true)");
    const challengeApplication = await db.query(`SELECT public.register_guest_program_application_checked(
        $1,NULL,$2::jsonb,'{}'::jsonb,$3) AS result`, [challenge.rows[0].result.id,
        JSON.stringify({ name: '검증용 챌린지 신청자', school: '검증용 학교', phone: challengePhone,
            birth_date: '2008-03-15', privacy_consent: true }),
        challenge.rows[0].result.application_form_revision]);
    assert.equal(challengeApplication.rows[0].result.status, 'JOIN');

    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [claims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [account.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    const sessionNotice = {
        ...JSON.parse(syntheticNotice), title: '검증용 회차 프로그램 (자동 롤백)',
        program_start_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
        program_end_date: new Date(Date.now() + 259_200_000).toISOString().slice(0, 10),
        guest_properties: { allow_guest: true, schedule_mode: 'RECURRING',
            application_scope: 'SESSION', require_school: true, require_phone: true },
    };
    const sessionProgram = await db.query(`SELECT public.save_program_settings_atomic(
        NULL,$1::jsonb,NULL,NULL,NULL) AS result`, [JSON.stringify(sessionNotice)]);
    await db.query('SET LOCAL ROLE postgres');
    const sessionDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const session = await db.query(`INSERT INTO public.daily_program_sessions
        (notice_id,session_date,starts_at,session_summary,capacity,status)
        VALUES($1,$2,$3,'검증용 회차',2,'OPEN') RETURNING id`, [
        sessionProgram.rows[0].result.id, sessionDate,
        new Date(Date.now() + 172_800_000).toISOString(),
    ]);
    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [memberClaims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [member.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    const sessionMember = await db.query(`SELECT public.respond_to_program_session_checked(
        $1,$2,'JOIN','{}'::jsonb,$3) AS result`, [
        session.rows[0].id, member.rows[0].id,
        sessionProgram.rows[0].result.application_form_revision,
    ]);
    assert.equal(sessionMember.rows[0].result.status, 'JOIN');
    await db.query('SET LOCAL ROLE postgres');
    const memberSessionRow = await db.query(`SELECT application_form_revision,application_form_snapshot
        FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2`, [
        session.rows[0].id, member.rows[0].id,
    ]);
    assert.equal(memberSessionRow.rows[0]?.application_form_revision,
        sessionProgram.rows[0].result.application_form_revision);
    assert.ok(memberSessionRow.rows[0]?.application_form_snapshot);
    let sessionPhone;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `010${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
        const collision = await db.query(`SELECT 1 FROM public.users
            WHERE regexp_replace(coalesce(phone,''),'[^0-9]','','g')=$1 LIMIT 1`, [candidate]);
        if (collision.rowCount === 0) { sessionPhone = candidate; break; }
    }
    if (!sessionPhone) throw new Error('Unable to reserve session synthetic phone');
    await db.query('SET LOCAL ROLE anon');
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',true)");
    await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
    await db.query("SELECT set_config('request.jwt.claim.role','anon',true)");
    const sessionGuest = await db.query(`SELECT public.register_guest_program_application_checked(
        NULL,$1,$2::jsonb,'{}'::jsonb,$3) AS result`, [session.rows[0].id,
        JSON.stringify({ name: '검증용 회차 신청자', school: '검증용 학교', phone: sessionPhone,
            birth_date: '2008-03-15', privacy_consent: true }),
        sessionProgram.rows[0].result.application_form_revision]);
    assert.equal(sessionGuest.rows[0].result.status, 'JOIN');
    await db.query('SET LOCAL ROLE postgres');
    const guestSessionRow = await db.query(`SELECT application_form_revision,application_form_snapshot
        FROM public.daily_program_session_responses WHERE session_id=$1 AND user_id=$2`, [
        session.rows[0].id, sessionGuest.rows[0].result.user_id,
    ]);
    assert.equal(guestSessionRow.rows[0]?.application_form_revision,
        sessionProgram.rows[0].result.application_form_revision);
    assert.ok(guestSessionRow.rows[0]?.application_form_snapshot);

    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [claims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [account.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    const surveyNotice = { ...JSON.parse(syntheticNotice),
        title: '검증용 설문 프로그램 (자동 롤백)',
        guest_properties: { allow_guest: true, application_scope: 'PROGRAM',
            require_school: true, require_phone: true, enable_feedback: true } };
    const surveyDefinition = { title: '검증용 설문', questions: [
        { id: 'test-question', title: '검증용 질문', type: 'short', required: false },
    ] };
    const surveyProgram = await db.query(`SELECT public.save_program_settings_atomic(
        NULL,$1::jsonb,NULL,$2::jsonb,NULL) AS result`, [
        JSON.stringify(surveyNotice), JSON.stringify({ definition: surveyDefinition }),
    ]);
    assert.ok(surveyProgram.rows[0].result.survey?.version_id);
    const surveyId = surveyProgram.rows[0].result.id;
    await db.query(`SELECT public.save_program_settings_atomic(
        $1,$2::jsonb,$3,NULL,NULL)`, [surveyId, JSON.stringify(surveyNotice),
        surveyProgram.rows[0].result.application_form_revision]);
    await db.query('SET LOCAL ROLE postgres');
    const surveyState = await db.query(`SELECT n.guest_properties->>'survey_version_id' AS version_id,
        (SELECT count(*)::integer FROM public.survey_links l WHERE l.notice_id=n.id AND l.enabled) AS enabled_links
        FROM public.notices n WHERE n.id=$1`, [surveyId]);
    assert.equal(surveyState.rows[0].version_id, surveyProgram.rows[0].result.survey.version_id);
    assert.equal(surveyState.rows[0].enabled_links, 1);
    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [claims]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [account.rows[0].auth_user_id]);
    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
    surveyNotice.guest_properties.enable_feedback = false;
    await db.query(`SELECT public.save_program_settings_atomic(
        $1,$2::jsonb,$3,NULL,NULL)`, [surveyId, JSON.stringify(surveyNotice),
        surveyProgram.rows[0].result.application_form_revision]);
    await db.query('SET LOCAL ROLE postgres');
    const disabled = await db.query(`SELECT count(*)::integer AS count FROM public.survey_links
        WHERE notice_id=$1 AND enabled`, [surveyId]);
    assert.equal(disabled.rows[0].count, 0);

    await db.query('ROLLBACK');
    transactionOpen = false;
    await db.query('BEGIN');
    transactionOpen = true;
    await db.query('SET LOCAL ROLE postgres');
    const afterCounts = (await db.query(countsSql)).rows[0];
    assert.deepEqual(afterCounts, beforeCounts, 'The rollback left persistent rows behind');
    await db.query('ROLLBACK');
    transactionOpen = false;
    console.log(JSON.stringify({ projectRef, result: 'rolled_back',
        checks: ['verified_staff_save', 'stale_edit_rejected', 'direct_relation_fallback',
            'guest_application_and_snapshot', 'member_application_and_snapshot',
            'capacity_waitlist_and_promotion', 'challenge_mission_and_guest_application',
            'recurring_session_member_application', 'recurring_session_guest_application',
            'atomic_survey_save_preserve_and_disable'] }));
} finally {
    if (transactionOpen) await db.query('ROLLBACK').catch(() => {});
    await db.end().catch(() => {});
}
