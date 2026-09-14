import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const id = crypto.randomUUID();
const lateJoiner = crypto.randomUUID();
const waitlisted = crypto.randomUUID();
const sessionId = crypto.randomUUID();

await db.exec(`
  CREATE TABLE public.logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL,
    type text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.daily_program_sessions (
    id uuid PRIMARY KEY,
    session_date date NOT NULL,
    voided_at timestamptz
  );
  CREATE TABLE public.daily_program_session_responses (
    session_id uuid NOT NULL REFERENCES public.daily_program_sessions(id),
    user_id uuid NOT NULL,
    status text NOT NULL,
    is_attended boolean NOT NULL DEFAULT false,
    PRIMARY KEY (session_id, user_id)
  );
  INSERT INTO public.daily_program_sessions(id, session_date)
  VALUES ('${sessionId}', (now() AT TIME ZONE 'Asia/Seoul')::date);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260910061000_auto_attend_daily_sessions.sql', import.meta.url), 'utf8'));

// Joining before check-in is marked by the logs trigger.
await db.query(`INSERT INTO public.daily_program_session_responses(session_id,user_id,status) VALUES($1,$2,'JOIN')`, [sessionId, id]);
await db.query(`INSERT INTO public.logs(user_id,type) VALUES($1,'CHECKIN')`, [id]);
assert.equal((await db.query(`SELECT is_attended FROM public.daily_program_session_responses WHERE user_id=$1`, [id])).rows[0].is_attended, true);

// Checking in first is also marked when the application later becomes JOIN.
await db.query(`INSERT INTO public.logs(user_id,type) VALUES($1,'CHECKIN')`, [lateJoiner]);
await db.query(`INSERT INTO public.daily_program_session_responses(session_id,user_id,status) VALUES($1,$2,'JOIN')`, [sessionId, lateJoiner]);
assert.equal((await db.query(`SELECT is_attended FROM public.daily_program_session_responses WHERE user_id=$1`, [lateJoiner])).rows[0].is_attended, true);

// Waitlisted applicants are never counted as attendees just because they checked in.
await db.query(`INSERT INTO public.daily_program_session_responses(session_id,user_id,status) VALUES($1,$2,'WAITLIST')`, [sessionId, waitlisted]);
await db.query(`INSERT INTO public.logs(user_id,type) VALUES($1,'CHECKIN')`, [waitlisted]);
assert.equal((await db.query(`SELECT is_attended FROM public.daily_program_session_responses WHERE user_id=$1`, [waitlisted])).rows[0].is_attended, false);

console.log('PASS daily session attendance: check-in-first, join-first, and waitlist behavior');
