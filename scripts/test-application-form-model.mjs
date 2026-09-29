import assert from 'node:assert/strict';
import {
    APPLICATION_AUDIENCE,
    legacyGuestDraftQuestions,
    legacyGuestMigrationIssue,
    legacyGuestQuestions,
    materializeProgramApplicationForm,
    questionsForAudience,
    validateApplicationAnswers,
    validateApplicationForm,
} from '../src/features/programs/applicationFormModel.js';

const guestProperties = { custom_fields: [
    { id: 'guest_field_older', label: ' 성별 ', type: 'select', required: true, options: ['여', '남'] },
    { id: 'guest_note', label: '메모', type: 'textarea', required: false },
    { id: 'blank', label: ' ', type: 'text' },
] };
const guestQuestions = legacyGuestQuestions(guestProperties);
assert.deepEqual(guestQuestions.map(question => question.id), ['guest_field_older', 'guest_note']);
assert.deepEqual(legacyGuestDraftQuestions(guestProperties).map(question => question.id), ['guest_field_older', 'guest_note', 'blank']);
assert.equal(legacyGuestDraftQuestions(guestProperties)[0].label, ' 성별 ');
assert.equal(guestQuestions[0].audience, APPLICATION_AUDIENCE.GUEST);
assert.equal(guestProperties.custom_fields[0].label, ' 성별 ');
assert.deepEqual(materializeProgramApplicationForm(null, guestProperties).questions, guestQuestions);
assert.deepEqual(materializeProgramApplicationForm(null, {}).questions, []);
assert.deepEqual(materializeProgramApplicationForm({ questions: [] }, guestProperties), { questions: [] });
assert.match(legacyGuestMigrationIssue(guestProperties), /비어 있는/);
assert.match(legacyGuestMigrationIssue({ custom_fields: {} }), /배열/);
assert.match(legacyGuestMigrationIssue({ custom_fields: [guestProperties.custom_fields[0], guestProperties.custom_fields[0]] }), /중복/);
assert.equal(legacyGuestMigrationIssue({ custom_fields: [guestProperties.custom_fields[0]] }), null);

const form = { questions: [
    { id: 'member_school', label: '학교', type: 'text', required: true, audience: 'MEMBER', options: [] },
    { id: 'all_reason', label: '참여 이유', type: 'textarea', required: false, audience: 'ALL', options: [] },
    ...guestQuestions,
] };
assert.equal(validateApplicationForm(form), null);
assert.deepEqual(questionsForAudience(form, 'MEMBER').map(question => question.id), ['member_school', 'all_reason']);
assert.deepEqual(questionsForAudience(form, 'GUEST').map(question => question.id), ['all_reason', 'guest_field_older', 'guest_note']);
assert.equal(validateApplicationAnswers(form, 'MEMBER', { member_school: '하이픈중' }), null);
assert.match(validateApplicationAnswers(form, 'MEMBER', {}), /학교/);
assert.match(validateApplicationAnswers(form, 'GUEST', {}), /성별/);
assert.equal(validateApplicationAnswers(form, 'GUEST', { guest_field_older: '남' }), null);
assert.match(validateApplicationAnswers(form, 'GUEST', { guest_field_older: '기타' }), /선택지/);
assert.match(validateApplicationAnswers(form, 'MEMBER', { member_school: '하이픈중', guest_field_older: '남' }), /해당하지 않는/);
assert.match(validateApplicationAnswers(form, 'GUEST', { guest_field_older: '남', member_school: '하이픈중' }), /해당하지 않는/);
assert.match(validateApplicationAnswers(form, 'MEMBER', { member_school: 'x'.repeat(3001) }), /3,000자/);
assert.match(validateApplicationAnswers(form, 'MEMBER', { member_school: ['하이픈중'] }), /확인/);
assert.match(validateApplicationAnswers(form, 'MEMBER', null), /형식/);
assert.match(validateApplicationAnswers(form, 'MEMBER', { member_school: '한'.repeat(11000) }), /크기/);
assert.match(validateApplicationForm({ questions: [form.questions[0], form.questions[0]] }), /중복/);
assert.match(validateApplicationForm({ questions: [{ ...form.questions[0], audience: 'UNKNOWN' }] }), /대상/);
assert.match(validateApplicationForm({ questions: [{ ...guestQuestions[0], options: ['여', ' 여'] }] }), /중복/);
assert.match(validateApplicationForm({ questions: [{ ...form.questions[0], id: '__proto__' }] }), /식별자/);
assert.match(validateApplicationForm({ questions: [{ ...form.questions[0], label: 123 }] }), /질문 내용/);
assert.match(validateApplicationForm({ questions: [{ ...form.questions[0], options: null }] }), /선택지/);
console.log('application form audience, legacy ID, definition, and answer validation passed');
