import assert from 'node:assert/strict';
import { resolveNotificationEvent } from '../supabase/functions/_shared/notificationEvent.mjs';

const rows = {
  notices: [
    { id: 10, title: '하이픈 프로그램', target_regions: ['강동'] },
    { id: 20, title: '이높 프로그램', target_regions: ['강서'] },
    { id: 30, title: '공동 프로그램', target_regions: ['강동', '강서'] },
    { category: 'SYSTEM', title: 'STAFF_PRESENCE_CONFIG', content: JSON.stringify({ '하이픈': [], '이높플레이스': ['staff-1'] }) },
  ],
  notice_responses: [
    { notice_id: 10, user_id: 'user-1', status: 'JOIN', created_at: '2026-09-09T00:00:00Z' },
    { notice_id: 20, user_id: 'user-1', status: 'JOIN', created_at: '2026-09-09T00:01:00Z' },
    { notice_id: 30, user_id: 'user-1', status: 'JOIN', created_at: '2026-09-09T00:02:00Z' },
  ],
  users: [
    { id: 'user-1', name: '홍길동', school: '학교', user_group: '학생' },
    { id: 'staff-1', name: '선생님' },
  ],
  logs: [
    { id: 'log-haifn', user_id: 'user-1', location_id: 'loc-haifn', type: 'CHECKIN', created_at: '2026-09-09T01:00:00Z' },
    { id: 'log-enough', user_id: 'user-1', location_id: 'loc-enough', type: 'CHECKOUT', created_at: '2026-09-09T02:00:00Z' },
  ],
  locations: [
    { id: 'loc-haifn', name: '2F', group_id: 'group-haifn' },
    { id: 'loc-enough', name: '이높플레이스', group_id: 'group-enough' },
  ],
  location_groups: [
    { id: 'group-haifn', name: '하이픈' },
    { id: 'group-enough', name: '이높플레이스' },
  ],
  coffee_chats: [
    { id: 'coffee-1', student_id: 'user-1', staff_id: 'staff-1', topics: ['진로'], message: '', status: 'PENDING' },
  ],
};

const readOne = async (table, query) => {
  const filters = query.filter(([key]) => !['select', 'limit', 'order'].includes(key));
  return (rows[table] || []).find((row) => filters.every(([key, expression]) => {
    const expected = String(expression).replace(/^eq\./, '');
    return String(row[key]) === expected;
  })) || null;
};

for (const [noticeId, expected] of [[10, ['HAIFN']], [20, ['ENOUGH_PLACE']], [30, ['HAIFN', 'ENOUGH_PLACE']]]) {
  const event = await resolveNotificationEvent({ eventType: 'PROGRAM_APPLICATION', noticeId, userId: 'user-1', status: 'JOIN' }, { readOne });
  assert.deepEqual(event.centerCodes, expected);
}

const checkin = await resolveNotificationEvent({ eventType: 'VISIT_CHECKIN', logId: 'log-haifn' }, { readOne });
assert.deepEqual(checkin.centerCodes, ['HAIFN']);
assert.match(checkin.message, /CHECK-IN/);

const checkout = await resolveNotificationEvent({ eventType: 'VISIT_CHECKOUT', logId: 'log-enough' }, { readOne });
assert.deepEqual(checkout.centerCodes, ['ENOUGH_PLACE']);
assert.match(checkout.message, /CHECK-OUT/);

const coffee = await resolveNotificationEvent({ eventType: 'COFFEE_CHAT_APPLICATION', coffeeChatId: 'coffee-1' }, { readOne });
assert.deepEqual(coffee.centerCodes, ['ENOUGH_PLACE']);
assert.match(coffee.message, /쌤에게 대화를 신청했어요!/);
assert.doesNotMatch(coffee.message, /쌍에게/);

await assert.rejects(
  resolveNotificationEvent({ eventType: 'VISIT_CHECKIN', logId: 'missing' }, { readOne }),
  /could not be verified/,
);

console.log('notification event tests passed');
