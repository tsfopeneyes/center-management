import assert from 'node:assert/strict';
import { participantAnswerCellStates, participantAnswerCells, participantAnswerColumns, participantAnswerDetails, sortParticipantsByAnswer } from '../src/features/programs/application/participantAnswerColumns.js';

const questions = [
    { id: 'member', label: '회원 질문', audience: 'MEMBER' },
    { id: 'guest', label: '비회원 질문', audience: 'GUEST' },
    { id: 'both', label: '공통 질문', audience: 'ALL' },
];
const member = { id: 'member', application_audience: 'MEMBER', application_answers: { member: '10', both: '참여' },
    application_form_snapshot: { questions } };
const guest = { id: 'guest', application_audience: 'GUEST', application_answers: { guest: '응답' },
    application_form_snapshot: { questions } };
const old = { id: 'old', application_answers: {}, application_form_snapshot: { questions: [] } };
const changed = { id: 'changed', application_audience: 'MEMBER', application_answers: { member: '옛 답변' },
    application_form_snapshot: { questions: [{ id: 'member', label: '옛 질문', audience: 'MEMBER' }] } };
const participants = [member, guest, old, changed];
const columns = participantAnswerColumns(participants, [], questions);
assert.deepEqual(columns.map(column => column.shortLabel), ['Q1', 'Q2', 'Q3']);
assert.deepEqual(columns.map(column => column.audience), ['MEMBER', 'GUEST', 'ALL']);
assert.deepEqual(participantAnswerCellStates(member, columns, [], questions).map(cell => cell.kind), ['answered', 'not_applicable', 'answered']);
assert.deepEqual(participantAnswerCellStates(guest, columns, [], questions).map(cell => cell.kind), ['not_applicable', 'answered', 'blank']);
assert.deepEqual(participantAnswerCellStates(old, columns, [], questions).map(cell => cell.kind), ['blank', 'blank', 'blank']);
assert.equal(participantAnswerCellStates(old, columns, [], questions)[0].audienceUnknown, true);
assert.deepEqual(participantAnswerCells(changed, columns, [], questions), [null, null, null]);
assert.deepEqual(participantAnswerDetails(changed, [], questions).map(entry => entry.label), ['옛 질문']);
assert.deepEqual(participantAnswerDetails(old, [], questions), []);
assert.deepEqual(participantAnswerDetails({ application_answers: { orphan: '보존' } }, [], questions).map(entry => entry.answer), ['보존']);
assert.deepEqual(sortParticipantsByAnswer(participants, columns[0], 'asc', [], questions).map(person => person.id), ['member', 'guest', 'old', 'changed']);
const numeric = [
    { id: 'ten', application_answers: { member: '10' } },
    { id: 'two', application_answers: { member: '2' } },
    { id: 'blank', application_answers: {} },
];
assert.deepEqual(sortParticipantsByAnswer(numeric, columns[0], 'asc', [], questions).map(person => person.id), ['two', 'ten', 'blank']);
assert.deepEqual(participantAnswerColumns([old], [], questions).map(column => column.label), questions.map(question => question.label));
assert.deepEqual(participantAnswerColumns([old], [], []), []);
console.log('current member/guest questions, immutable-audience cells, historical details and sorting pass');
