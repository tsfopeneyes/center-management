import assert from 'node:assert/strict';
import { parseGuestBirthDate } from '../src/utils/guestBirthUtils.js';

const beforeBirthdayKst = new Date('2026-03-14T14:59:00Z');
const onBirthdayKst = new Date('2026-03-14T15:00:00Z');
assert.equal(parseGuestBirthDate('2012-03-15', beforeBirthdayKst)?.isUnder14, true);
assert.equal(parseGuestBirthDate('2012-03-15', onBirthdayKst)?.isUnder14, false);
assert.equal(parseGuestBirthDate('2026-03-15', beforeBirthdayKst), null);
assert.equal(parseGuestBirthDate('2026-03-15', onBirthdayKst)?.age, 0);
assert.equal(parseGuestBirthDate('2020-02-30', onBirthdayKst), null);
assert.equal(parseGuestBirthDate('1920-03-15', onBirthdayKst), null);
assert.equal(parseGuestBirthDate('2008-03-15', onBirthdayKst)?.yymmdd, '080315');
console.log('guest age and guardian threshold use the same KST day as server validation');
