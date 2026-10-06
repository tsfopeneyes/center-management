import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync(new URL('../src/components/admin/board/components/modals/ParticipantModal.jsx', import.meta.url), 'utf8');
const attendance = readFileSync(new URL('../src/components/admin/board/components/modals/AttendanceSection.jsx', import.meta.url), 'utf8');
assert.ok(modal.includes('availableDates.map(date =>'), 'date selector must remain available outside the roster view');
assert.ok(modal.includes('<ChallengeStatusSection') && modal.includes('onOpenMissionPosts={(student, mission)'),
    'online challenge proof must open from the challenge view');
assert.ok(attendance.includes('onClick={() => toggleQuestionSort(col.key)}'), 'question headers must sort');
assert.ok(!attendance.includes('setQuestion('), 'question headers must not open an extra row below the table');
console.log('participant modal date, challenge and question sorting wiring passed');
