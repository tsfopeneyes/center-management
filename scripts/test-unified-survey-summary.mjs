import assert from 'node:assert/strict';
import { summarizeSurveyEntries } from '../src/utils/unifiedSurveySummary.js';

const title = '오늘 센터에서는 어떤 활동을 함께했나요?';
const first = { id: 'old-id', title, type: 'multiple', options: ['교제 및 휴식', '개인 할 일', '프로그램 참여'] };
const second = { id: 'new-id', title: ` ${title} `, type: 'multiple', options: ['프로그램 참여', '개인 할 일', '교제 및 휴식'] };
const changed = { id: 'changed', title, type: 'multiple', options: ['교제 및 휴식', '새 활동'] };
const row = (id, question, answer, aggregation_excluded = false) => ({
    id, snapshot: { questions: [question] }, answers: { [question.id]: answer }, aggregation_excluded,
});
const groups = summarizeSurveyEntries([
    row('1', first, ['교제 및 휴식', '개인 할 일']),
    row('2', second, ['교제 및 휴식', '프로그램 참여']),
    row('3', first, ['교제 및 휴식'], true),
    row('4', changed, ['새 활동']),
]);
assert.equal(groups.length, 2);
assert.equal(groups[0].count, 2);
assert.deepEqual(groups[0].choices, { '교제 및 휴식': 2, '개인 할 일': 1, '프로그램 참여': 1 });
assert.equal(groups[1].count, 1);
console.log('Unified survey summary checks passed.');
