import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {inHaifnHours} from '../supabase/functions/send-recruitment-alerts/haifn-push-worker.mjs';
const db=new PGlite();
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

await db.exec(readFileSync('supabase/migrations/20260930010000_haifn_intro_chat.sql','utf8'));
await db.exec("CREATE SCHEMA cron; CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS 'SELECT 1::bigint'; CREATE FUNCTION public.dm_invoke_notification_worker() RETURNS void LANGUAGE sql AS 'SELECT';");
await db.exec(readFileSync('supabase/migrations/20261001010000_haifn_business_hours_push.sql','utf8'));
for(const [time,expected] of [['2026-10-01T00:59:00Z',false],['2026-10-01T01:00:00Z',true],['2026-10-01T08:59:00Z',true],['2026-10-01T09:00:00Z',false],['2026-10-03T01:00:00Z',false]])assert.equal(inHaifnHours(new Date(time)),expected);
const session=(await db.query("INSERT INTO haifn_chat_sessions(token_hash) VALUES('test') RETURNING id")).rows[0].id;
await db.query("INSERT INTO haifn_chat_messages(session_id,sender,body,created_at) VALUES($1,'VISITOR','안녕하세요','2026-10-02T02:00:00Z')",[session]);
let rows=(await db.query("SELECT kind,count(*)::int AS n,min(next_attempt_at)::text AS due FROM haifn_chat_push_deliveries GROUP BY kind")).rows;
assert.equal(rows.find(x=>x.kind==='NEW').n,4);assert.equal(rows.find(x=>x.kind==='REMINDER').n,4);assert.match(rows.find(x=>x.kind==='REMINDER').due,/2026-10-05 01:00/);
await db.query("INSERT INTO haifn_chat_messages(session_id,sender,body) VALUES($1,'VISITOR','씨발')",[session]);
assert.equal((await db.query('SELECT moderation FROM haifn_chat_sessions WHERE id=$1',[session])).rows[0].moderation,'FILTERED');
assert.equal((await db.query('SELECT count(*)::int AS n FROM haifn_chat_push_deliveries')).rows[0].n,8);
assert.equal((await db.query('SELECT count(*)::int AS n FROM haifn_chat_messages')).rows[0].n,2);
console.log('PASS: Seoul business hours, weekend reminder, four recipients, filtered queue suppression, content preserved');
}finally{await db.close();}
