import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

await db.exec(`
    CREATE ROLE account_login_worker;
    CREATE ROLE account_profile_worker;
    CREATE ROLE account_membership_worker;
    CREATE ROLE account_merge_worker;
    CREATE TABLE public.schools (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        region text
    );
    CREATE TABLE public.users (
        id uuid PRIMARY KEY,
        school text,
        status text
    );
    CREATE TABLE public.school_logs (
        id uuid PRIMARY KEY,
        school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE
    );
    CREATE TABLE public.contents (
        id uuid PRIMARY KEY,
        school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE
    );
    CREATE TABLE public.rentals (
        id uuid PRIMARY KEY,
        school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE
    );

    INSERT INTO public.schools(id,name,region) VALUES
        ('10000000-0000-0000-0000-000000000001','강동고등학교','강동'),
        ('10000000-0000-0000-0000-000000000002','강서여자고등학교','강서');
    INSERT INTO public.users(id,school,status) VALUES
        ('20000000-0000-0000-0000-000000000001','강동고','approved'),
        ('20000000-0000-0000-0000-000000000002','미등록학교','approved');

    GRANT USAGE ON SCHEMA public TO account_profile_worker;
    GRANT SELECT(id,school),UPDATE(school) ON public.users TO account_profile_worker;
`);

const migration = await readFile(
    new URL('../supabase/migrations/20260922010000_link_users_to_schools.sql', import.meta.url),
    'utf8'
);
await db.exec(migration);

const backfilled = await db.query(`
    SELECT school,school_id::text FROM public.users ORDER BY id
`);
assert.equal(backfilled.rows[0].school_id, '10000000-0000-0000-0000-000000000001');
assert.equal(backfilled.rows[1].school_id, null);
assert.equal(backfilled.rows[1].school, '미등록학교');

await db.exec(`
    SET ROLE account_profile_worker;
    UPDATE public.users SET school='강서여고'
    WHERE id='20000000-0000-0000-0000-000000000002';
    RESET ROLE;
`);
const workerUpdate = await db.query(`
    SELECT school_id::text FROM public.users
    WHERE id='20000000-0000-0000-0000-000000000002'
`);
assert.equal(workerUpdate.rows[0].school_id, '10000000-0000-0000-0000-000000000002');

await db.exec(`
    INSERT INTO public.users(id,school,status) VALUES
        ('20000000-0000-0000-0000-000000000003','강서여고','approved');
    INSERT INTO public.users(id,school_id,status) VALUES
        ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','approved');
`);
const inserted = await db.query(`
    SELECT id::text,school,school_id::text FROM public.users
    WHERE id IN (
        '20000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000004'
    ) ORDER BY id
`);
assert.equal(inserted.rows[0].school_id, '10000000-0000-0000-0000-000000000002');
assert.equal(inserted.rows[1].school, '강동고등학교');

await db.exec(`
    UPDATE public.users SET school='새로운미등록학교'
    WHERE id='20000000-0000-0000-0000-000000000003';
`);
const unmatchedUpdate = await db.query(`
    SELECT school,school_id::text FROM public.users
    WHERE id='20000000-0000-0000-0000-000000000003'
`);
assert.equal(unmatchedUpdate.rows[0].school, '새로운미등록학교');
assert.equal(unmatchedUpdate.rows[0].school_id, null);

await db.exec(`
    DELETE FROM public.users
    WHERE school_id='10000000-0000-0000-0000-000000000001';
    INSERT INTO public.school_logs(id,school_id) VALUES
        ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
`);
await assert.rejects(
    db.exec(`DELETE FROM public.schools WHERE id='10000000-0000-0000-0000-000000000001'`),
    /foreign key|violates/i
);

await db.exec(`
    DELETE FROM public.school_logs
    WHERE school_id='10000000-0000-0000-0000-000000000001';
    INSERT INTO public.users(id,school_id,status) VALUES
        ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','approved');
    DELETE FROM public.schools
    WHERE id='10000000-0000-0000-0000-000000000001';
`);
const retainedUser = await db.query(`
    SELECT school,school_id::text FROM public.users
    WHERE id='20000000-0000-0000-0000-000000000005'
`);
assert.equal(retainedUser.rows[0].school, '강동고등학교');
assert.equal(retainedUser.rows[0].school_id, null);

console.log('user-school link migration: all checks passed');
await db.close();
