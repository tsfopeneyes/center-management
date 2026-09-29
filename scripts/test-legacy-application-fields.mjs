import assert from 'node:assert/strict';
import {
    findMissingRequiredField,
    listVisibleLegacyGuestFields,
    readLegacyGuestFields,
    serializeLegacyGuestFields,
} from '../src/features/programs/applicationFields.js';

const fields = [
    { id: 'gender', label: ' 성별 ', type: 'select', required: true, options: ['여', '', '남'] },
    { id: 'note', label: '메모', type: 'textarea', required: false, options: [] },
    { id: 'empty', label: '  ', type: 'text', required: true },
    { id: '', label: 'ID 없음', type: 'text', required: true },
];
assert.deepEqual(readLegacyGuestFields(null), []);
assert.equal(readLegacyGuestFields({ custom_fields: fields }), fields);
assert.deepEqual(listVisibleLegacyGuestFields({ custom_fields: fields }), fields.slice(0, 2));
assert.deepEqual(serializeLegacyGuestFields(fields), [
    { id: 'gender', label: '성별', type: 'select', required: true, options: ['여', '남'] },
    { id: 'note', label: '메모', type: 'textarea', required: false, options: [] },
    { id: '', label: 'ID 없음', type: 'text', required: true, options: [] },
]);
assert.deepEqual(serializeLegacyGuestFields([{ id: 'x', label: '기타', type: 'unknown', required: 1 }]), [
    { id: 'x', label: '기타', type: 'text', required: false, options: [] },
]);
assert.equal(findMissingRequiredField(fields, { gender: '여' }), fields[2]);
assert.equal(findMissingRequiredField(fields.slice(0, 2), { gender: ' 여 ' }), undefined);
assert.equal(findMissingRequiredField(fields.slice(0, 2), { gender: '   ' }), fields[0]);
console.log('legacy guest application field compatibility passed');
