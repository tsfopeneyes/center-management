import assert from 'node:assert/strict';
import { getGuardianAge, getGuardianCleanup } from '../src/utils/guardianAge.js';

const before = new Date('2026-10-11T14:59:59Z');
const birthday = new Date('2026-10-11T15:00:00Z');
assert.equal(getGuardianAge('121012', before), 13);
assert.equal(getGuardianAge('121012', birthday), 14);
assert.deepEqual(getGuardianCleanup('121012', before), {});
assert.deepEqual(getGuardianCleanup('121012', birthday), {
    guardian_name: null, guardian_phone: null, guardian_relation: null
});
assert.equal(getGuardianAge('101023', birthday), 15);
assert.equal(getGuardianAge('201023', birthday), 5);
for (const invalid of ['', '1010', '101332', '230229', '271012', '261013']) {
    assert.equal(getGuardianAge(invalid, birthday), null);
    assert.deepEqual(getGuardianCleanup(invalid, birthday), {});
}
assert.equal(getGuardianAge('120229', new Date('2026-02-28T15:00:00Z')), 14);
console.log('PASS guardian age: KST birthday boundary, corrected birth, invalid dates, scoped cleanup');
