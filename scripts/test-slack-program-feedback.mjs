import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadSlackFeedback, fixtureReader } from './slack-feedback-harness.mjs';

const notice = { id: 151, title: 'DINNER CHURCH [10월: 담다]', category: 'PROGRAM', program_date: '2026-10-23T08:30:00Z', guest_properties: {} };
const tables = { notices: [notice], notice_responses: [], users: [], program_feedback: [], survey_entries: [],
    staff_directory: [], daily_program_sessions: [], daily_program_session_responses: [], open_program_attendance: [] };
const read = fixtureReader(tables);
// The released code crashes when no legacy feedback exists, even for a valid program.
const released = execFileSync('git', ['show', 'a5315da:supabase/functions/slack-tsf/index.ts'], { encoding: 'utf8' });
const old = await loadSlackFeedback(read, released);
await assert.rejects(() => old.metrics({ query: '디너처치' }), /reading 'map'/);
const app = await loadSlackFeedback(read);
const args = { query: '디너처치', start_date: '2026-10-01', end_date: '2026-10-31' };
assert.equal((await app.metrics(args)).programs[0].feedback_count, 0);
assert.equal((await app.metrics({ query: '없는 프로그램' })).programs.length, 0);
assert.equal(await app.originals('없는 프로그램'), '');

tables.users = [{ id: 'u1', name: '테스트' }];
const snapshot = { questions: [{ id: 'score', title: '만족도', type: 'star', metric: 'satisfaction' },
    { id: 'choice', title: '기억에 남는 활동', type: 'multiple' }, { id: 'note', title: '추가 의견', type: 'text' }] };
tables.survey_entries = [
    { id: 'a', notice_id: 151, user_id: 'u1', snapshot, answers: { score: 4, choice: ['대화', '식사'], note: '다음에도 참여' }, created_at: '2026-10-23T10:00:00Z' },
    { id: 'b', notice_id: 151, user_id: 'u1', snapshot, answers: { score: 2 }, created_at: '2026-10-23T10:01:00Z' },
    { id: 'c', notice_id: 151, user_id: 'u1', snapshot, answers: { score: 1 }, aggregation_excluded: true, created_at: '2026-10-23T10:02:00Z' },
];
let program = (await app.metrics(args)).programs[0];
assert.equal(program.feedback_count, 3);
assert.equal(program.feedback_sources.survey, 3);
assert.equal(program.별점.평균, 3);
assert.equal(program.별점.응답수, 2);
assert.equal(program.feedback[0].답변[1].answer, '대화, 식사');
const original = await app.originals('디너처치');
assert.ok(original.includes('추가 의견: 다음에도 참여'));
assert.ok(original.includes('기억에 남는 활동: 대화, 식사'));

tables.program_feedback = [{ notice_id: 151, user_id: 'u1', q1_reason: '기존 응답', created_at: '2026-10-22T10:00:00Z' }];
program = (await app.metrics(args)).programs[0];
assert.equal(program.feedback_count, 4);
assert.equal(program.feedback_sources.legacy, 1);
assert.equal(program.feedback[0].답변[0].answer, '기존 응답');
tables.survey_entries.push({ id: 'd', notice_id: 151, user_id: 'u1',
    snapshot: { questions: [{ id: 'score', title: '다른 버전 질문', type: 'star' }] }, answers: { score: 5 }, created_at: '2026-10-24T00:00:00Z' });
program = (await app.metrics(args)).programs[0];
assert.equal(program.별점, null);
assert.equal(program.별점_질문별.length, 2);
assert.equal(program.feedback.at(-1).답변[0].question, '다른 버전 질문');
const failing = await loadSlackFeedback(async (table, params) => {
    if (table === 'survey_entries') throw new Error('Supabase survey_entries 조회 오류 (503)');
    return read(table, params);
});
await assert.rejects(() => failing.metrics(args), /survey_entries.*503/);
// Saving must preserve the selected occurrence even if the model supplies only
// the series alias, and reject legacy ambiguous drafts rather than mixing months.
tables.notices.push({ ...notice, id: 109, title: 'DINNER CHURCH [9월: 관심]', program_date: '2026-09-01T08:30:00Z' });
tables.program_feedback.push({ notice_id: 109, user_id: 'u1', q1_reason: '이전 회차만의 응답', created_at: '2026-09-01T10:00:00Z' });
await assert.rejects(() => app.originals('디너처치'), /한 프로그램 회차/);
const locked = { title: notice.title + ' 결과 보고서', programFeedbackQuery: '디너처치' };
await app.bindProgram(locked);
assert.equal(locked.programFeedbackNoticeId, '151');
const lockedOriginal = await app.originals(locked.programFeedbackQuery, locked.programFeedbackNoticeId);
assert.ok(!lockedOriginal.includes('이전 회차만의 응답'));
assert.equal((await app.metrics({ query: notice.title })).programs.length, 1);
await assert.rejects(() => app.bindProgram({ title: 'DINNER CHURCH 결과 보고서' }), /회차를 하나로/);
await assert.rejects(() => app.bindProgram({ ...locked, programFeedbackNoticeId: '109' }), /회차를 하나로/);
console.log('Slack feedback passed: released crash reproduced; empty/no-match, modern/legacy, snapshots, multiple choices, ratings/exclusions, original appendix, and read errors verified.');
