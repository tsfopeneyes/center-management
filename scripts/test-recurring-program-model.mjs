import assert from 'node:assert/strict';
import {
    countProgramOccurrences,
    getNextProgramOccurrence,
    isProgramOccurrenceDate,
    usesDailySessionRsvp,
} from '../src/utils/dailyProgramSessions.js';

const recurring = {
    category: 'PROGRAM',
    is_recruiting: true,
    is_challenge: false,
    program_start_date: '2026-09-01',
    program_end_date: '2026-09-30',
    program_days: [4],
    guest_properties: { schedule_mode: 'RECURRING', application_scope: 'SESSION' },
};

assert.equal(usesDailySessionRsvp(recurring), true);
assert.equal(countProgramOccurrences(recurring), 4);
assert.equal(isProgramOccurrenceDate(recurring, '2026-09-03'), true);
assert.equal(isProgramOccurrenceDate(recurring, '2026-09-04'), false);
assert.equal(getNextProgramOccurrence(recurring, new Date('2026-09-10T00:00:00+09:00')), '2026-09-10');
assert.equal(getNextProgramOccurrence(recurring, new Date('2026-10-01T00:00:00+09:00')), null);

const open = { ...recurring, is_recruiting: false, guest_properties: { schedule_mode: 'RECURRING', application_scope: 'NONE' } };
assert.equal(usesDailySessionRsvp(open), false);

const legacy = { ...open, guest_properties: { open_participation_mode: 'SESSION_RSVP' } };
assert.equal(usesDailySessionRsvp(legacy), true);

console.log('recurring program model tests passed');
