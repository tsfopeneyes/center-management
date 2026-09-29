import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL only. This proposal is not applied to the linked DB.
const db = new PGlite();
const form = { questions: [
    { id: 'member_school', label: '학교', type: 'text', required: true, audience: 'MEMBER', options: [] },
    { id: 'guest_gender', label: '성별', type: 'select', required: true, audience: 'GUEST', options: ['여', '남'] },
] };
try {
    await db.exec(`
        CREATE TABLE public.notices (id bigint PRIMARY KEY, title text NOT NULL);
        CREATE TABLE public.notice_responses (
            id bigint PRIMARY KEY, notice_id bigint NOT NULL, user_id uuid NOT NULL,
            status text NOT NULL, application_answers jsonb NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE TABLE public.daily_program_session_responses (
            session_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL,
            application_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
            PRIMARY KEY(session_id,user_id)
        );
        INSERT INTO public.notices VALUES (1,'기존 프로그램');
        INSERT INTO public.notice_responses VALUES
            (1,1,'00000000-0000-0000-0000-000000000001','JOIN','{"legacy":"unchanged"}');
        INSERT INTO public.daily_program_session_responses VALUES
            ('00000000-0000-0000-0000-000000000002',
             '00000000-0000-0000-0000-000000000003','CANCELLED','{"legacy":"unchanged"}');
    `);
    const beforeWhole = (await db.query('SELECT * FROM public.notice_responses')).rows;
    const beforeSession = (await db.query('SELECT * FROM public.daily_program_session_responses')).rows;
    await db.exec(readFileSync(new URL('../supabase/manual/proposals/20260929_application_form_snapshots.sql', import.meta.url), 'utf8'));

    const oldNotice = (await db.query('SELECT application_form,application_form_revision FROM public.notices WHERE id=1')).rows[0];
    assert.equal(oldNotice.application_form, null);
    assert.equal(oldNotice.application_form_revision, 0);
    assert.deepEqual((await db.query('SELECT id,notice_id,user_id,status,application_answers FROM public.notice_responses')).rows, beforeWhole);
    assert.deepEqual((await db.query('SELECT session_id,user_id,status,application_answers FROM public.daily_program_session_responses')).rows, beforeSession);
    assert.equal((await db.query('SELECT application_form_snapshot FROM public.notice_responses')).rows[0].application_form_snapshot, null);

    await db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify(form)]);
    assert.equal((await db.query('SELECT application_form_revision FROM public.notices WHERE id=1')).rows[0].application_form_revision, 1);
    await db.exec("UPDATE public.notices SET title='새 제목' WHERE id=1");
    assert.equal((await db.query('SELECT application_form_revision FROM public.notices WHERE id=1')).rows[0].application_form_revision, 1);
    await db.query('UPDATE public.notices SET application_form=$1,application_form_revision=900 WHERE id=1', [JSON.stringify(form)]);
    assert.equal((await db.query('SELECT application_form_revision FROM public.notices WHERE id=1')).rows[0].application_form_revision, 1);
    await db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [...form.questions, {
        id: 'all_reason', label: '참여 이유', type: 'textarea', required: false, audience: 'ALL', options: [],
    }] })]);
    assert.equal((await db.query('SELECT application_form_revision FROM public.notices WHERE id=1')).rows[0].application_form_revision, 2);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=NULL WHERE id=1'), /legacy mode/);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [form.questions[0], form.questions[0]] })]), /Invalid application question/);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [{ ...form.questions[1], options: ['여', ' 여'] }] })]), /Invalid application choice/);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [{ ...form.questions[0], type: undefined }] })]), /Invalid application question/);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [{ ...form.questions[0], id: 123 }] })]), /Invalid application question/);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [{ ...form.questions[0], required: undefined }] })]), /Invalid application question/);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [{ ...form.questions[1], options: undefined }] })]), /Invalid application choices/);
    await assert.rejects(db.query('UPDATE public.notices SET application_form=$1 WHERE id=1', [JSON.stringify({ questions: [{ ...form.questions[0], options: {} }] })]), /Unexpected application choices/);
    assert.equal((await db.query('SELECT application_form_revision FROM public.notices WHERE id=1')).rows[0].application_form_revision, 2);

    const checkAnswers = (audience, answers) => db.query(
        'SELECT public.validate_program_application_answers($1::jsonb,$2,$3::jsonb)',
        [JSON.stringify(form), audience, JSON.stringify(answers)]
    );
    await checkAnswers('MEMBER', { member_school: '하이픈중' });
    await checkAnswers('GUEST', { guest_gender: '남' });
    await assert.rejects(checkAnswers('MEMBER', {}), /Required application answer/);
    await assert.rejects(checkAnswers('GUEST', {}), /Required application answer/);
    await assert.rejects(checkAnswers('MEMBER', { member_school: '하이픈중', guest_gender: '남' }), /does not belong/);
    await assert.rejects(checkAnswers('GUEST', { guest_gender: '기타' }), /Invalid application choice/);
    await assert.rejects(checkAnswers('MEMBER', { member_school: ['하이픈중'] }), /Invalid answer type/);
    await assert.rejects(checkAnswers('MEMBER', { member_school: 'x'.repeat(3001) }), /too long/);
    await assert.rejects(checkAnswers('MEMBER', { member_school: '하이픈중', extra: '값' }), /does not belong/);
    console.log('application form revision proposal preserves old rows, increments only on valid form changes, and rejects invalid definitions');
} finally {
    await db.close();
}
