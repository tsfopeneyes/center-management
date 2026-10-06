import assert from 'node:assert/strict';
import { getParticipantButtonLabel, hasParticipantExtraScreen } from '../src/features/programs/participantExperience.js';

const base = { enable_post_program_button: true, enable_group_assignment: false, enable_random_questions: false };
assert.equal(hasParticipantExtraScreen(base), false);
assert.equal(hasParticipantExtraScreen({ ...base, post_program_button_content: '안내 내용' }), true);
assert.equal(hasParticipantExtraScreen({ ...base, post_program_button_link: 'https://example.com' }), true);
assert.equal(hasParticipantExtraScreen({ ...base, enable_post_program_button: false, post_program_button_content: '안내 내용' }), false);
assert.equal(getParticipantButtonLabel({ ...base, post_program_button_content: '안내 내용' }), '프로그램 안내');
assert.equal(getParticipantButtonLabel({ ...base, enable_group_assignment: true, enable_random_questions: true, random_questions: ['질문'] }), '팀 확인 및 나눔 질문');
assert.equal(hasParticipantExtraScreen({ guest_properties: { ...base, post_program_button_link: 'https://example.com' } }), true);
assert.equal(hasParticipantExtraScreen({ guest_properties: { ...base, random_questions: 'legacy', enable_random_questions: true } }), false);
console.log('participant extra screen visibility and label tests passed');
