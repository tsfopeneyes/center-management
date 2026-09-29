import assert from 'node:assert/strict';
import pg from 'pg';

// Fixed temporary loopback database. Never accepts a remote connection string.
const connection = { host: '127.0.0.1', port: 55432, user: 'postgres',
    database: 'codex_session_20260929', connectionTimeoutMillis: 3000,
    application_name: 'codex-isolated-session-concurrency-test' };
const clients = [];
const identities = new WeakMap();
const open = async (role = null, userId = null) => {
    const client = new pg.Client(connection);
    await client.connect();
    clients.push(client);
    if (role) await client.query(`SET ROLE ${role}`);
    if (userId) {
        await client.query("SELECT set_config('test.member_id',$1,false)", [userId]);
        identities.set(client, userId);
    }
    return client;
};
const answer = { session_answer: '동시 신청 확인' };
const submit = (client, sessionId, action = 'JOIN') => client.query(`
    INSERT INTO public.member_program_session_applications
        (session_id,user_id,action,application_answers)
    VALUES($1,$2,$3,$4::jsonb) RETURNING status
`, [sessionId, identities.get(client), action, JSON.stringify(answer)]);
const createProgram = async (admin, noticeId, form, capacity = 1) => {
    const sessionId = crypto.randomUUID();
    await admin.query(`INSERT INTO public.notices
        (id,category,is_recruiting,is_challenge,guest_properties,program_status,application_form)
        VALUES($1,'PROGRAM',true,false,
            '{"schedule_mode":"RECURRING","application_scope":"SESSION","allow_guest":true}',
            'ACTIVE',$2::jsonb)`, [noticeId, JSON.stringify(form)]);
    await admin.query(`INSERT INTO public.daily_program_sessions
        (id,notice_id,session_date,starts_at,session_summary,capacity)
        VALUES($1,$2,(now() AT TIME ZONE 'Asia/Seoul')::date + 1,
            now()+interval '1 day','격리 동시성 시험 회차',$3)`, [sessionId, noticeId, capacity]);
    return sessionId;
};

try {
    const admin = await open();
    const ids = Array.from({ length: 3 }, () => crypto.randomUUID());
    for (const [index, id] of ids.entries()) {
        await admin.query(`INSERT INTO public.users
            (id,auth_user_id,name,user_group,role,status)
            VALUES($1,$1,$2,'청소년','user','approved')`,
        [id, `격리 회차 회원 ${index + 1}`]);
    }
    const members = await Promise.all(ids.map(id => open('authenticated', id)));
    const form = { questions: [{ id: 'session_answer', label: '동시성 답변',
        type: 'text', required: true, audience: 'MEMBER', options: [] }] };
    const baseId = Date.now();

    for (let round = 0; round < 10; round++) {
        const sessionId = await createProgram(admin, baseId + round, form);
        const first = await Promise.all([submit(members[0], sessionId), submit(members[1], sessionId)]);
        assert.deepEqual(first.map(result => result.rows[0].status).sort(), ['JOIN', 'WAITLIST']);
        const joinIndex = first.findIndex(result => result.rows[0].status === 'JOIN');
        const waitIndex = 1 - joinIndex;
        const after = await Promise.all([
            submit(members[joinIndex], sessionId, 'CANCEL'),
            submit(members[2], sessionId),
        ]);
        assert.equal(after[0].rows[0].status, 'CANCELLED');
        assert.equal(after[1].rows[0].status, 'WAITLIST');
        const final = await admin.query(`SELECT user_id,status FROM public.daily_program_session_responses
            WHERE session_id=$1`, [sessionId]);
        assert.equal(final.rows.find(row => row.user_id === ids[waitIndex])?.status, 'JOIN');
        assert.equal(final.rows.find(row => row.user_id === ids[2])?.status, 'WAITLIST');
        assert.equal(final.rows.find(row => row.user_id === ids[joinIndex])?.status, 'CANCELLED');
        const count = await admin.query('SELECT join_count FROM public.daily_program_sessions WHERE id=$1', [sessionId]);
        assert.equal(count.rows[0].join_count, 1);
    }

    const guestSessionId = await createProgram(admin, baseId + 100, { questions: [] }, 10);
    const guests = await Promise.all([open('anon'), open('anon')]);
    const profile = { name: '격리 회차 비회원', school: '격리 학교',
        phone: '010-9999-0129', birth_date: '2008-03-15', privacy_consent: true };
    const results = await Promise.all(guests.map(client => client.query(`
        SELECT public.register_guest_program_application(
            NULL::bigint,$1,$2::jsonb,'{}'::jsonb) AS result
    `, [guestSessionId, JSON.stringify(profile)])));
    assert.equal(results[0].rows[0].result.user_id, results[1].rows[0].result.user_id);
    assert.equal(results[0].rows[0].result.status, 'JOIN');
    assert.equal(results[1].rows[0].result.status, 'JOIN');
    const userCount = await admin.query(`SELECT count(*)::integer AS count FROM public.users
        WHERE regexp_replace(phone,'[^0-9]','','g')='01099990129'`);
    assert.equal(userCount.rows[0].count, 1);
    const responseCount = await admin.query(`SELECT count(*)::integer AS count
        FROM public.daily_program_session_responses WHERE session_id=$1`, [guestSessionId]);
    assert.equal(responseCount.rows[0].count, 1);
    console.log('PASS: real PostgreSQL parallel session capacity/promotion (10 rounds) and same-phone atomic guest registration');
} finally {
    await Promise.allSettled(clients.map(client => client.end()));
}
