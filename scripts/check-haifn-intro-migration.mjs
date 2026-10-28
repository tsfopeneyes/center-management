import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
    await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE TABLE public.users (id uuid PRIMARY KEY, name text NOT NULL, user_group text NOT NULL, status text NOT NULL);
        INSERT INTO public.users VALUES
          ('00000000-0000-0000-0000-000000000001','Jin','STAFF','approved'),
          ('00000000-0000-0000-0000-000000000002','Zoe','STAFF','approved'),
          ('00000000-0000-0000-0000-000000000003','Sunny','STAFF','approved'),
          ('00000000-0000-0000-0000-000000000004','Zzang','STAFF','approved');
        CREATE OR REPLACE FUNCTION public.current_profile_id() RETURNS uuid
        LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.test_profile_id', true), '')::uuid $$;
        CREATE OR REPLACE FUNCTION public.is_current_staff() RETURNS boolean
        LANGUAGE sql STABLE AS $$ SELECT true $$;
    `);
    const migration = readFileSync(new URL('../supabase/migrations/20260930010000_haifn_intro_chat.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const { rows } = await db.query(`
        SELECT c.relrowsecurity AS rls_enabled,
               (SELECT count(*) FROM pg_policies WHERE tablename IN ('haifn_chat_sessions','haifn_chat_messages','haifn_chat_operators','haifn_chat_operator_notifications'))::int AS policy_count,
               (SELECT count(*) FROM public.haifn_chat_sessions)::int AS row_count,
               (SELECT count(*) FROM public.haifn_chat_operators)::int AS operator_count
        FROM pg_class c WHERE c.oid = 'public.haifn_chat_sessions'::regclass
    `);
    const state = rows[0];
    if (!state?.rls_enabled || state.policy_count !== 7 || state.row_count !== 0 || state.operator_count !== 4) {
        throw new Error(`Unexpected migration state: ${JSON.stringify(state)}`);
    }
    await db.exec('SET ROLE anon');
    let anonymousInsertBlocked = false;
    try {
        await db.exec("INSERT INTO public.haifn_chat_sessions (token_hash) VALUES ('unsafe')");
    } catch {
        anonymousInsertBlocked = true;
    }
    let anonymousReadBlocked = false;
    try { await db.query('SELECT * FROM public.haifn_chat_sessions'); }
    catch { anonymousReadBlocked = true; }
    await db.exec('RESET ROLE');
    if (!anonymousInsertBlocked || !anonymousReadBlocked) throw new Error('Anonymous direct table access was allowed');
    await db.exec(`
        INSERT INTO public.haifn_chat_sessions (id,token_hash) VALUES
          ('10000000-0000-0000-0000-000000000001','sample-hash');
        SET ROLE authenticated;
        SET app.test_profile_id = '00000000-0000-0000-0000-000000000001';
    `);
    const { rows: operatorRows } = await db.query('SELECT id FROM public.haifn_chat_sessions');
    if (operatorRows.length !== 1) throw new Error('Designated operator cannot read visitor conversations');
    await db.exec(`INSERT INTO public.haifn_chat_messages (session_id,sender,sender_id,body)
      VALUES ('10000000-0000-0000-0000-000000000001','STAFF','00000000-0000-0000-0000-000000000001','안녕하세요');`);
    const { rows: repliedRows } = await db.query("SELECT status,assigned_to FROM public.haifn_chat_sessions WHERE id='10000000-0000-0000-0000-000000000001'");
    if (repliedRows[0]?.status !== 'IN_PROGRESS' || repliedRows[0]?.assigned_to !== '00000000-0000-0000-0000-000000000001') {
        throw new Error('Staff reply did not update the shared conversation');
    }
    const { rows: notificationRows } = await db.query('SELECT operator_id FROM public.haifn_chat_operator_notifications');
    if (notificationRows.length !== 0) throw new Error('Operator could read other operators’ notifications');
    await db.exec("SET app.test_profile_id = '00000000-0000-0000-0000-000000000002'");
    const { rows: zoeNotifications } = await db.query('SELECT operator_id FROM public.haifn_chat_operator_notifications');
    if (zoeNotifications.length !== 1) throw new Error('Other operator was not notified of staff reply');
    await db.exec(`SET app.test_profile_id = '00000000-0000-0000-0000-000000000099'`);
    const { rows: outsiderRows } = await db.query('SELECT id FROM public.haifn_chat_sessions');
    if (outsiderRows.length) throw new Error('Non-operator could read visitor conversations');
    let outsiderWriteBlocked = false;
    try {
        await db.exec(`INSERT INTO public.haifn_chat_messages (session_id,sender,sender_id,body)
          VALUES ('10000000-0000-0000-0000-000000000001','STAFF','00000000-0000-0000-0000-000000000099','wrong');`);
    } catch { outsiderWriteBlocked = true; }
    await db.exec('RESET ROLE');
    if (!outsiderWriteBlocked) throw new Error('Non-operator could reply to a visitor');
    console.log('HAIFN chat migration: local schema check passed (private tables inaccessible to anonymous clients).');
} finally {
    await db.close();
}
