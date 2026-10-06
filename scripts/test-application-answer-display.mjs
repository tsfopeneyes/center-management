import assert from 'node:assert/strict';
import { applicationAnswerEntries } from '../src/features/programs/application/applicationAnswerDisplay.js';

const legacyFields = [{ id: 'old_id', label: '현재 표시 이름' }];
assert.deepEqual(applicationAnswerEntries({ application_answers: {} }, legacyFields), []);
assert.deepEqual(applicationAnswerEntries({ application_answers: { old_id: '예', gone: '기록', empty: '' } }, legacyFields), [
    { id: 'old_id', label: '현재 표시 이름', audience: null, answer: '예', revision: null, definitionKnown: false },
    { id: 'gone', label: '질문 gone', audience: null, answer: '기록', revision: null, definitionKnown: false },
]);
assert.deepEqual(applicationAnswerEntries({
    application_answers: { old_id: '예', member_id: '학교' },
    application_form_revision: 4,
    application_form_snapshot: { questions: [
        { id: 'old_id', label: '신청 당시 이름', audience: 'ALL' },
        { id: 'member_id', label: '회원 질문', audience: 'MEMBER' },
    ] },
}, legacyFields), [
    { id: 'old_id', label: '신청 당시 이름', audience: 'ALL', answer: '예', revision: 4, definitionKnown: true },
    { id: 'member_id', label: '회원 질문', audience: 'MEMBER', answer: '학교', revision: 4, definitionKnown: true },
]);
assert.deepEqual(applicationAnswerEntries({ application_answers: [] }, legacyFields), []);
console.log('application answers use response snapshots; legacy labels remain best effort');
