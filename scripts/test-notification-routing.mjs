import assert from 'node:assert/strict';
import {
  CENTER_CODES,
  centerFromLocationText,
  centersFromTargetRegions,
  destinationSecretName,
  enabledDestinations,
  normalizeRoutingConfig,
} from '../supabase/functions/_shared/notificationRouting.mjs';
import { resolveNotificationEvent } from '../supabase/functions/_shared/notificationEvent.mjs';

assert.deepEqual(centersFromTargetRegions(['강동']), [CENTER_CODES.HAIFN]);
assert.deepEqual(centersFromTargetRegions(['강서']), [CENTER_CODES.ENOUGH_PLACE]);
assert.deepEqual(centersFromTargetRegions(['강동', '강서', '강동']), [CENTER_CODES.HAIFN, CENTER_CODES.ENOUGH_PLACE]);
assert.deepEqual(centersFromTargetRegions([]), []);

assert.equal(centerFromLocationText('하이픈 2F'), CENTER_CODES.HAIFN);
assert.equal(centerFromLocationText('이높플레이스'), CENTER_CODES.ENOUGH_PLACE);
assert.equal(centerFromLocationText('하이픈 강서'), null);
assert.equal(centerFromLocationText('외부 행사장'), null);

const config = normalizeRoutingConfig({
  ENOUGH_PLACE: { slack: { program: false } },
});
assert.equal(config.ENOUGH_PLACE.slack.program, false);
assert.equal(config.ENOUGH_PLACE.line.program, true);
assert.equal(config.HAIFN.slack.program, true);
assert.equal(destinationSecretName({ centerCode: 'HAIFN', channel: 'line' }), 'LINE_HAIFN_GROUP_ID');
assert.equal(destinationSecretName({ centerCode: 'ENOUGH_PLACE', channel: 'slack' }), 'SLACK_ENOUGH_CHANNEL_ID');

assert.deepEqual(enabledDestinations({
  centerCodes: ['HAIFN', 'ENOUGH_PLACE'],
  category: 'program',
  routingConfig: config,
}), [
  { centerCode: 'HAIFN', channel: 'line' },
  { centerCode: 'HAIFN', channel: 'slack' },
  { centerCode: 'ENOUGH_PLACE', channel: 'line' },
]);

const requestedStatuses = [];
const resolveApplication = createdAt => resolveNotificationEvent({
  eventType: 'PROGRAM_APPLICATION', noticeId: 1, userId: 'member-1', status: 'WAITLIST',
}, { readOne: async (table, query) => {
  if (table === 'notice_responses') {
    requestedStatuses.push(query.find(([key]) => key === 'status')?.[1]);
    return { notice_id: 1, user_id: 'member-1', status: 'WAITLIST', created_at: createdAt };
  }
  if (table === 'notices') return { id: 1, title: '테스트 프로그램', target_regions: ['강동'] };
  if (table === 'users') return { id: 'member-1', name: '테스트 회원' };
  return null;
} });
const firstAttempt = await resolveApplication('2026-09-29T09:00:00+09:00');
const secondAttempt = await resolveApplication('2026-09-30T09:00:00+09:00');
assert.deepEqual(requestedStatuses, ['eq.WAITLIST', 'eq.WAITLIST']);
assert.match(firstAttempt.message, /대기 신청했어요/);
assert.notEqual(firstAttempt.eventKey, secondAttempt.eventKey,
  'a later application attempt must have a distinct delivery key');

console.log('notification routing tests passed');
