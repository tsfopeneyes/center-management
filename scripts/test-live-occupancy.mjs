import assert from 'node:assert/strict';
import { calculateCurrentLocations, countActiveUsersByGroup, mergeRealtimeVisitLog } from '../src/utils/liveOccupancyUtils.js';

const canonicalEnoughPlaceId = 'ENOUGH_PLACE';
const visitDate = '2026-09-02';
const activeNow = new Date(`${visitDate}T10:00:00.000Z`); // 19:00 KST

const checkin = {
    id: 'checkin-1',
    user_id: 'student-1',
    type: 'CHECKIN',
    location_id: canonicalEnoughPlaceId,
    created_at: `${visitDate}T08:00:00.000Z`,
};

assert.equal(
    calculateCurrentLocations([checkin], activeNow)['student-1']?.locId,
    canonicalEnoughPlaceId,
    'A current-day Enough Place check-in must remain visible.'
);

const move = {
    id: 'move-1',
    user_id: 'student-2',
    type: 'MOVE',
    location_id: canonicalEnoughPlaceId,
    created_at: `${visitDate}T09:00:00.000Z`,
};

assert.equal(
    calculateCurrentLocations([move], activeNow)['student-2']?.locId,
    canonicalEnoughPlaceId,
    'A move into Enough Place must appear as active occupancy.'
);

const checkout = {
    id: 'checkout-1',
    user_id: 'student-1',
    type: 'CHECKOUT',
    location_id: canonicalEnoughPlaceId,
    created_at: `${visitDate}T09:30:00.000Z`,
};

assert.equal(
    calculateCurrentLocations([checkin, checkout], activeNow)['student-1'],
    null,
    'Checkout must clear the active occupancy.'
);

const mergedCheckout = mergeRealtimeVisitLog([checkin], { eventType: 'INSERT', new: checkout, old: {} });
assert.equal(
    calculateCurrentLocations(mergedCheckout, activeNow)['student-1'],
    null,
    'A realtime checkout must update the local snapshot without a full refetch.'
);

const groups = [{ id: 'gangseo' }, { id: 'gangdong' }];
const groupCounts = countActiveUsersByGroup({
    currentLocations: calculateCurrentLocations([checkin, move], activeNow),
    users: [{ id: 'student-1' }, { id: 'student-2', account_role: 'staff' }],
    locations: [{ id: canonicalEnoughPlaceId, group_id: 'gangseo' }],
    groups,
    isStaff: user => user.account_role === 'staff',
});
assert.deepEqual(groupCounts, { gangseo: 1, gangdong: 0, unassigned: 0 }, 'Staff must remain excluded from live occupancy totals.');

assert.equal(
    calculateCurrentLocations([checkin], new Date('2026-09-03T01:00:00.000Z'))['student-1'],
    null,
    'A previous-day visit must not carry into the live list.'
);

const sameTimeCheckout = { ...checkout, created_at: checkin.created_at };
assert.equal(
    calculateCurrentLocations([sameTimeCheckout, checkin], activeNow)['student-1'],
    null,
    'Checkout must win when events share a timestamp.'
);

console.log('Live occupancy checks passed.');
