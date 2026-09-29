import assert from 'node:assert/strict';
import pg from 'pg';

// This test can connect only to the temporary loopback PostgreSQL instance.
const connection = {
    host: '127.0.0.1', port: 55432, user: 'postgres',
    database: 'codex_transition_20260929_r2', connectionTimeoutMillis: 3000,
    application_name: 'codex-isolated-program-concurrency-test',
};
const clients = [];
const identities = new WeakMap();
const open = async (role = null, userId = null) => {
    const client = new pg.Client(connection);
    await client.connect();
    clients.push(client);
    if (role) await client.query(`SET ROLE ${role}`);
    if (userId) await client.query("SELECT set_config('test.member_id',$1,false)", [userId]);
    if (userId) identities.set(client, userId);
    return client;
};
const answer = { test_answer: '동시 신청 확인' };
const submit = (client, noticeId, action = 'JOIN') => client.query(`
    INSERT INTO public.member_program_applications
        (notice_id,user_id,action,application_answers)
    VALUES($1,$2,$3,$4::jsonb) RETURNING status
`, [noticeId, identities.get(client), action, JSON.stringify(answer)]);
const createProgram = (client, noticeId, form, capacity = 1) => client.query(`
    INSERT INTO public.notices
        (id,title,category,is_recruiting,is_challenge,guest_properties,program_status,
         recruitment_start_at,recruitment_deadline,recruitment_details_ready,program_date,
         max_capacity,application_form)
    VALUES($1,'격리 동시성 시험','PROGRAM',true,false,
        '{"allow_guest":true,"application_scope":"PROGRAM"}','ACTIVE',
        now()-interval '1 day',now()+interval '1 day',true,now()+interval '2 days',
        $2,$3::jsonb)
`, [noticeId, capacity, JSON.stringify(form)]);

try {
    const admin = await open();
    const ids = Array.from({ length: 3 }, () => crypto.randomUUID());
    for (const [index, id] of ids.entries()) {
        await admin.query(`INSERT INTO public.users
            (id,auth_user_id,name,user_group,role,status)
            VALUES($1,$1,$2,'청소년','student','approved')`,
        [id, `격리 회원 ${index + 1}`]);
    }
    const members = await Promise.all(ids.map(id => open('authenticated', id)));
    const form = { questions: [{ id: 'test_answer', label: '동시성 답변',
        type: 'text', required: true, audience: 'MEMBER', options: [] }] };
    const baseId = Date.now();

    for (let round = 0; round < 10; round++) {
        const noticeId = baseId + round;
        await createProgram(admin, noticeId, form);
        const results = await Promise.all([submit(members[0], noticeId), submit(members[1], noticeId)]);
        assert.deepEqual(results.map(result => result.rows[0].status).sort(), ['JOIN', 'WAITLIST']);
        const counts = await admin.query(`SELECT status,count(*)::integer AS count
            FROM public.notice_responses WHERE notice_id=$1 GROUP BY status`, [noticeId]);
        assert.deepEqual(counts.rows.sort((a, b) => a.status.localeCompare(b.status)),
            [{ status: 'JOIN', count: 1 }, { status: 'WAITLIST', count: 1 }]);

        const joinIndex = results.findIndex(result => result.rows[0].status === 'JOIN');
        const waitIndex = 1 - joinIndex;
        const after = await Promise.all([
            submit(members[joinIndex], noticeId, 'CANCEL'),
            submit(members[2], noticeId),
        ]);
        assert.equal(after[0].rows[0].status, 'CANCELLED');
        assert.equal(after[1].rows[0].status, 'WAITLIST');
        const final = await admin.query(`SELECT user_id,status FROM public.notice_responses
            WHERE notice_id=$1 ORDER BY user_id`, [noticeId]);
        assert.equal(final.rows.length, 3);
        assert.equal(final.rows.find(row => row.user_id === ids[joinIndex])?.status, 'CANCELLED');
        assert.equal(final.rows.find(row => row.user_id === ids[waitIndex])?.status, 'JOIN');
        assert.equal(final.rows.find(row => row.user_id === ids[2])?.status, 'WAITLIST');
    }

    const guestNoticeId = baseId + 100;
    await createProgram(admin, guestNoticeId, { questions: [] }, 10);
    const guests = await Promise.all([open('anon'), open('anon')]);
    const profile = { name: '격리 비회원', school: '격리 학교',
        phone: '010-9999-0029', birth_date: '2008-03-15', privacy_consent: true };
    const guestResults = await Promise.all(guests.map(client => client.query(`
        SELECT public.register_guest_program_application(
            $1::bigint,NULL::uuid,$2::jsonb,'{}'::jsonb) AS result
    `, [guestNoticeId, JSON.stringify(profile)])));
    assert.equal(guestResults[0].rows[0].result.user_id, guestResults[1].rows[0].result.user_id);
    assert.equal(guestResults[0].rows[0].result.status, 'JOIN');
    assert.equal(guestResults[1].rows[0].result.status, 'JOIN');
    const guestCount = await admin.query(`SELECT count(*)::integer AS count FROM public.users
        WHERE regexp_replace(phone,'[^0-9]','','g')='01099990029'`);
    assert.equal(guestCount.rows[0].count, 1);
    const responseCount = await admin.query(`SELECT count(*)::integer AS count
        FROM public.notice_responses WHERE notice_id=$1`, [guestNoticeId]);
    assert.equal(responseCount.rows[0].count, 1);
    console.log('PASS: real PostgreSQL parallel member capacity/promotion (10 rounds) and same-phone atomic guest registration');
} finally {
    await Promise.allSettled(clients.map(client => client.end()));
}
