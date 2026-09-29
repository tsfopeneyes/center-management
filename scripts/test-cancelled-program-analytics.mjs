import assert from 'node:assert/strict';
import { isCurrentProgramAttendee } from '../src/features/programs/application/responseState.js';

const responses = [
    { status: 'JOIN', is_attended: true },
    { status: 'JOIN', is_attended: false },
    { status: 'WAITLIST', is_attended: true },
    { status: 'CANCELLED', is_attended: true },
];
assert.deepEqual(responses.map(isCurrentProgramAttendee), [true, false, false, false]);
assert.equal(responses.filter(isCurrentProgramAttendee).length, 1);
console.log('retained cancellations are excluded from current attendance counts');
